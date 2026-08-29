import { withSupabase } from "@supabase/server";

const SOURCE = "google_health";
const DEFAULT_TIMEZONE = "Asia/Tokyo";
const MAX_DAYS_PER_REQUEST = 31;
const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

type RequestBody = {
  start_date?: unknown;
  end_date?: unknown;
  timezone?: unknown;
  startDate?: unknown;
  endDate?: unknown;
};

type GoogleHealthResponse = {
  data?: {
    totalSteps?: unknown;
  };
};

type SyncResult = {
  records: Array<{
    step_date: string;
    steps: number;
    rewarded_steps: number;
    coins_awarded: number;
  }>;
  coins_awarded: number;
  balance: number;
  synced_at: string;
};

type SupabaseAdminClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dateList(startDate: string, endDate: string): string[] {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (days < 1 || days > MAX_DAYS_PER_REQUEST) {
    throw new Error(`対象期間は1日から${MAX_DAYS_PER_REQUEST}日以内で指定してください。`);
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start + index * 86_400_000);
    return date.toISOString().slice(0, 10);
  });
}

function today(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    throw new Error("タイムゾーンが不正です。");
  }
}

async function syncStepRewards(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  records: Array<{ step_date: string; steps: number }>,
): Promise<SyncResult> {
  const { data, error } = await supabaseAdmin.rpc("sync_step_rewards", {
    p_user_id: userId,
    p_source: SOURCE,
    p_records: records,
  });
  if (error || !data) {
    throw new Error(`歩数の保存に失敗しました: ${error?.message ?? "unknown"}`);
  }
  return data as SyncResult;
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return response({
        status: "error",
        code: "INVALID_INPUT",
        message: "POSTメソッドを使用してください。",
      }, 405);
    }

    const { data: userData, error: userError } = await ctx.supabase.auth.getUser();
    if (userError || !userData.user) {
      return response({
        status: "error",
        code: "UNAUTHENTICATED",
        message: "認証が必要です。",
      }, 401);
    }
    const userId = userData.user.id;

    let body: RequestBody;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("request body must be an object");
      }
      body = parsed as RequestBody;
    } catch {
      return response({
        status: "error",
        code: "INVALID_INPUT",
        message: "リクエストボディはJSONオブジェクトで指定してください。",
      }, 400);
    }

    const timezone = typeof body.timezone === "string" ? body.timezone : DEFAULT_TIMEZONE;
    let defaultDate: string;
    try {
      defaultDate = today(timezone);
    } catch (error) {
      return response({
        status: "error",
        code: "INVALID_INPUT",
        message: error instanceof Error ? error.message : "タイムゾーンが不正です。",
      }, 400);
    }
    const startDate = body.start_date ?? body.startDate ?? defaultDate;
    const endDate = body.end_date ?? body.endDate ?? startDate;
    if (!isDate(startDate) || !isDate(endDate)) {
      return response({
        status: "error",
        code: "INVALID_INPUT",
        message: "start_date と end_date は YYYY-MM-DD 形式で指定してください。",
      }, 400);
    }

    let dates: string[];
    try {
      dates = dateList(startDate, endDate);
    } catch (error) {
      return response({
        status: "error",
        code: "INVALID_INPUT",
        message: error instanceof Error ? error.message : "対象期間が不正です。",
      }, 400);
    }

    try {
      // 外部APIの呼び出しをDB更新から分離し、DBロックを保持しない。
      const records: Array<{ step_date: string; steps: number }> = [];
      for (const stepDate of dates) {
        const { data, error } = await ctx.supabase.functions.invoke(
          "google_health_fetch",
          {
            body: {
              startDate: stepDate,
              endDate: stepDate,
              timezone,
            },
          },
        );
        if (error) {
          throw new Error(`Google Health APIの取得に失敗しました: ${error.message}`);
        }
        const healthData = data as GoogleHealthResponse | null;
        const steps = Number(healthData?.data?.totalSteps ?? 0);
        if (!Number.isSafeInteger(steps) || steps < 0) {
          throw new Error("Google Health APIの歩数データが不正です。");
        }
        records.push({ step_date: stepDate, steps });
      }

      const syncData = await syncStepRewards(ctx.supabaseAdmin as unknown as SupabaseAdminClient, userId, records);

      return response({
        status: "ok",
        data: {
          userId,
          timezone,
          startDate,
          endDate,
          ...syncData,
        },
      });
    } catch (error) {
      console.error("Failed to synchronize Google Health steps.", error);
      return response({
        status: "error",
        code: "HEALTH_PROVIDER_ERROR",
        message: error instanceof Error ? error.message : "歩数の同期に失敗しました。",
      }, 502);
    }
  }),
};
