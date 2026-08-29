import { withSupabase } from "@supabase/server";

const GOOGLE_HEALTH_API_URL = "https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp";
const REQUIRED_SCOPE = "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";
const DEFAULT_TIMEZONE = "Asia/Tokyo";
const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function errorResponse(
  code: string,
  message: string,
  status = 200,
  details?: Record<string, unknown>,
): Response {
  const error: ApiError = { code, message };
  if (details) {
    error.details = details;
  }
  return jsonResponse({ ok: false, error }, status);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSafeInteger(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Math.trunc(Number(value.trim()));
  }
  return 0;
}

function getTokyoDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function parseJsonBody<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function exchangeAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const payload = await parseJsonBody<{ error?: { code?: string; message?: string } }>(response);
    throw new Error(payload?.error?.message ?? "google token exchange failed");
  }

  const payload = await parseJsonBody<{ access_token?: string; scope?: string }>(response);
  if (!payload?.access_token) {
    throw new Error("google access token missing");
  }

  const scopes = typeof payload.scope === "string"
    ? payload.scope.split(/\s+/).filter(Boolean)
    : [];

  if (scopes.length > 0 && !scopes.includes(REQUIRED_SCOPE)) {
    throw new Error("missing google health scope");
  }

  return payload.access_token;
}

async function fetchDailyStepsFromGoogle(accessToken: string, stepDate: string): Promise<number> {
  const dateParts = stepDate.split("-").map((part) => Number(part));
  const [year, month, day] = dateParts;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error("invalid date");
  }

  const body = {
    range: {
      start: {
        date: { year, month, day },
        time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 },
      },
      end: {
        date: { year, month, day },
        time: { hours: 23, minutes: 59, seconds: 59, nanos: 0 },
      },
    },
    windowSizeDays: 1,
  };

  const response = await fetch(GOOGLE_HEALTH_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await parseJsonBody<{ error?: { status?: string; message?: string } }>(response);
    throw new Error(payload?.error?.message ?? "google health fetch failed");
  }

  const payload = await parseJsonBody<{ dataPoints?: Array<{ value?: { steps?: { countSum?: unknown } } }> }>(response);
  const dataPoints = Array.isArray(payload?.dataPoints) ? payload.dataPoints : [];

  let totalSteps = 0;
  for (const dataPoint of dataPoints) {
    const value = isObject(dataPoint) ? dataPoint.value : null;
    const stepData = isObject(value) && isObject(value.steps) ? value.steps : undefined;
    const countValue = stepData ? (stepData as Record<string, unknown>).countSum : undefined;
    const fallbackValue = isObject(value) ? (value as Record<string, unknown>).countSum : undefined;
    const steps = toSafeInteger(countValue ?? fallbackValue ?? 0);
    totalSteps += steps;
  }

  return totalSteps;
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
      return errorResponse("INVALID_INPUT", "POST メソッドを使用してください。", 405);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_INPUT", "リクエストは JSON 形式である必要があります。", 400);
    }

    if (!isObject(body) || Object.keys(body).length > 0) {
      return errorResponse("INVALID_INPUT", "body は空オブジェクト {} のみ受け付けます。", 400);
    }

    const { data: userData, error: userError } = await ctx.supabase.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse("UNAUTHENTICATED", "認証が必要です。", 401);
    }

    const userId = userData.user.id;
    const requestId = crypto.randomUUID();

    try {
      type QueryBuilder = {
        select: (column: string) => QueryBuilder;
        eq: (column: string, value: unknown) => QueryBuilder;
        maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };

      const supabaseAdmin = ctx.supabaseAdmin as unknown as {
        from: (table: string) => QueryBuilder;
        rpc: (functionName: string, args: Record<string, unknown>) => Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
      };

      const { data: connectionData, error: connectionError } = await supabaseAdmin
        .from("health_connections")
        .select("refresh_token")
        .eq("user_id", userId)
        .eq("provider", "google_health")
        .maybeSingle();

      const connectionRow = connectionData as { refresh_token?: unknown } | null;
      if (connectionError || !connectionRow || typeof connectionRow.refresh_token !== "string") {
        return errorResponse("HEALTH_NOT_CONNECTED", "Google Health に未接続です。", 200);
      }

      const refreshToken = connectionRow.refresh_token.trim();
      if (!refreshToken) {
        return errorResponse("HEALTH_NOT_CONNECTED", "Google Health に未接続です。", 200);
      }

      const accessToken = await exchangeAccessToken(refreshToken);
      const stepDate = getTokyoDate();
      const totalSteps = await fetchDailyStepsFromGoogle(accessToken, stepDate);

      const { data: previousRecord } = await supabaseAdmin
        .from("daily_step_records")
        .select("rewarded_steps")
        .eq("user_id", userId)
        .eq("step_date", stepDate)
        .eq("source", "google_health")
        .maybeSingle();

      const previousRow = previousRecord as { rewarded_steps?: unknown } | null;
      const previousRewarded = typeof previousRow?.rewarded_steps === "number"
        ? previousRow.rewarded_steps
        : 0;
      const newlyRewardedSteps = Math.max(0, totalSteps - previousRewarded);

      const { data: syncData, error: syncError } = await supabaseAdmin.rpc(
        "public.sync_step_rewards",
        {
          p_user_id: userId,
          p_source: "google_health",
          p_records: [{ step_date: stepDate, steps: totalSteps }],
        },
      );

      if (syncError || !syncData) {
        return errorResponse("INTERNAL_ERROR", "歩数の同期に失敗しました。", 200);
      }

      const result = syncData as {
        coins_awarded?: number;
        balance?: number;
        synced_at?: string;
      };

      return jsonResponse({
        ok: true,
        data: {
          date: stepDate,
          timezone: DEFAULT_TIMEZONE,
          steps: totalSteps,
          newlyRewardedSteps,
          coinsAwarded: typeof result.coins_awarded === "number" ? result.coins_awarded : 0,
          coinBalance: typeof result.balance === "number" ? result.balance : 0,
          appliedBonuses: [],
          syncedAt: typeof result.synced_at === "string" ? result.synced_at : new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "歩数の同期に失敗しました。";
      const classification = message.includes("permission") || message.includes("scope")
        ? "HEALTH_PERMISSION_REQUIRED"
        : "HEALTH_PROVIDER_ERROR";

      console.error(
        JSON.stringify({
          requestId,
          status: classification === "HEALTH_PERMISSION_REQUIRED" ? 200 : 500,
          classification,
        }),
      );

      return classification === "HEALTH_PERMISSION_REQUIRED"
        ? errorResponse("HEALTH_PERMISSION_REQUIRED", "Google Health の権限が不足しています。", 200)
        : errorResponse("HEALTH_PROVIDER_ERROR", "Google Health との通信に失敗しました。", 200);
    }
  }),
};
