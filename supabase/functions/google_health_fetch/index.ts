import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Google Health API の dailyRollUp エンドポイント。
// 期間ごとの歩数をまとめて取得するために利用する。
const GOOGLE_HEALTH_API_URL =
  "https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp";

// デフォルトのタイムゾーン。
// 日本のユーザー向けに Tokyo を基本にしている。
const DEFAULT_TIMEZONE = "Asia/Tokyo";

// HTTP リクエストのボディで受け取る項目。
// 期間とタイムゾーンを任意で指定できるようにしている。
type RequestBody = {
  startDate?: string;
  endDate?: string;
  timezone?: string;
};

// Google OAuth で返ってくる access token の応答型。
type GoogleAccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

// Google Health API の `dailyRollUp` には `year/month/day` のオブジェクトが必要。
// そのため、日付を分解して渡す型を定義している。
type DateValue = {
  year: number;
  month: number;
  day: number;
};

// Google Health API の range 指定で必要になる time オブジェクト。
type TimeValue = {
  hours: number;
  minutes: number;
  seconds: number;
  nanos: number;
};

// 日付を `YYYY-MM-DD` 形式の文字列へ変換する。
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 受け取った日付文字列を Date に変換する。
// 変換できない場合は現時点のデータを安全に使えるようフォールバックする。
function parseDate(value: string, fallback: Date): Date {
  const parsed = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed;
}

// Date を Google API の要求形式に合わせて `year/month/day` に変換する。
function toDateValue(date: Date): DateValue {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

// Date を Google API の range.time 形式へ変換する。
function toTimeValue(date: Date): TimeValue {
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    nanos: 0,
  };
}

// Google Health API から返ってくる歩数は文字列または数値の可能性があるため、
// 安全に数値に直すための補正処理。
function coerceStepCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (/^\d+$/.test(normalized)) {
      return Number(normalized);
    }
  }

  return 0;
}

// Authorization ヘッダーから JWT を取り出し、ユーザー ID (`sub`) を取り出す。
// この ID を使って「どのユーザーの歩数か」を判定する。
function extractUserIdFromJwt(req: Request): string | null {
  const authorizationHeader = req.headers.get("Authorization") ?? "";
  const token = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice(7)
    : authorizationHeader;

  if (!token) {
    return null;
  }

  // JWT は header.payload.signature の形式なので payload 部分を取り出す。
  const payloadPart = token.split(".")[1];
  if (!payloadPart) {
    return null;
  }

  try {
    // JWT は Base64URL 形式のため、通常の Base64 に戻して JSON を読み込む。
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { sub?: string };
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

// Google OAuth の refresh token を使って有効な access token を取得する。
// これは Google Health API を呼ぶための「短時間有効な鍵」である。
async function getGoogleAccessToken(): Promise<string> {
  // Supabase の Secrets から Google の認証情報を取得する。
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_HEALTH_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Health OAuthの情報が登録されていません。Supabase Secrets に GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_HEALTH_REFRESH_TOKEN を設定してください。",
    );
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
    const errorText = await response.text();
    throw new Error(`Google token exchange failed: ${response.status} ${errorText}`);
  }

  const tokenData = (await response.json()) as GoogleAccessTokenResponse;
  if (!tokenData.access_token) {
    throw new Error("Google access token is missing from the token response.");
  }

  return tokenData.access_token;
}

// Google Health API へ歩数を問い合わせ、合計歩数と生データを返す。
async function fetchStepsFromGoogleHealth(
  accessToken: string,
  startDate: string,
  endDate: string,
) {
  // 1日分のみ取得するため、開始日を 0:00:00 に固定する。
  const baseDate = parseDate(startDate || endDate, new Date());
  const dayStart = new Date(baseDate);
  dayStart.setHours(0, 0, 0, 0);

  // 終了時刻は「取得開始時刻の1秒前」を基本にする。
  // ただし日付境界を跨がないように同日の 23:59:59 を上限として丸める。
  const fetchedAtMinusOneSecond = new Date(Date.now() - 1_000);
  const dayEndLimit = new Date(dayStart);
  dayEndLimit.setHours(23, 59, 59, 999);
  const cappedEnd = new Date(Math.min(fetchedAtMinusOneSecond.getTime(), dayEndLimit.getTime()));
  const effectiveEnd = cappedEnd.getTime() < dayStart.getTime() ? dayStart : cappedEnd;

  // Google Health API のリクエスト形式に合わせて 1日レンジを組み立てる。
  const body = {
    range: {
      start: {
        date: toDateValue(dayStart),
        time: {
          hours: 0,
          minutes: 0,
          seconds: 0,
          nanos: 0,
        },
      },
      end: {
        date: toDateValue(effectiveEnd),
        time: toTimeValue(effectiveEnd),
      },
    },
    windowSizeDays: 1,
  };

  const response = await fetch(GOOGLE_HEALTH_API_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Health API request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();

  // Google Health API からは `dataPoints` 配列が返るので、そこから歩数を取り出す。
  const rawDataPoints = Array.isArray(payload?.dataPoints) ? payload.dataPoints : [];

  let totalSteps = 0;
  for (const dataPoint of rawDataPoints) {
    const value = dataPoint?.value;
    // `steps.countSum` というキー名が複数の変形で返ることがあるので、順に探す。
    const stepValue = value?.steps?.countSum ?? value?.countSum ?? value?.steps?.count_sum;
    totalSteps += coerceStepCount(stepValue);
  }

  return {
    totalSteps,
    totalDays: rawDataPoints.length,
    payload,
  };
}

// Edge Function のエントリーポイント。
// Supabase の認証済みリクエストを受け取り、歩数取得処理を実行する。
export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req) => {
    // JWT からユーザー ID を抽出し、未認証なら即座に 401 を返す。
    const userId = extractUserIdFromJwt(req);
    if (!userId) {
      return Response.json(
        {
          status: "error",
          code: "UNAUTHENTICATED",
          message: "Authentication is required to fetch Google Health steps.",
        },
        {
          status: 401,
        },
      );
    }

    // リクエスト本文から期間とタイムゾーンを拾う。
    // JSON が不正でも失敗させずにデフォルト値を使う。
    let payload: RequestBody = {};
    try {
      payload = (await req.json()) as RequestBody;
    } catch {
      payload = {};
    }

    const timezone = payload.timezone ?? DEFAULT_TIMEZONE;
    const startDate = payload.startDate ?? formatDate(new Date());
    const endDate = payload.endDate ?? startDate;

    try {
      // Google の refresh token から access token を取得して、歩数データを取得する。
      const accessToken = await getGoogleAccessToken();
      const data = await fetchStepsFromGoogleHealth(accessToken, startDate, endDate);

      // 返す JSON はゲーム側で扱いやすいように、必要な情報だけを平坦化して返す。
      return Response.json({
        status: "ok",
        data: {
          userId,
          timezone,
          startDate,
          endDate,
          totalSteps: data.totalSteps,
          totalDays: data.totalDays,
          records: data.payload?.dataPoints ?? [],
        },
      });
    } catch (error) {
      // どこで失敗したかをログに残し、クライアントには失敗理由を返す。
      console.error("Failed to fetch Google Health steps.", error);
      return Response.json(
        {
          status: "error",
          code: "GOOGLE_HEALTH_FETCH_FAILED",
          message: error instanceof Error ? error.message : "Unknown error while fetching Google Health steps.",
        },
        {
          status: 500,
        },
      );
    }
  }),
};

/*
  ローカルでの呼び出し例:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/google_health_fetch' \
    --header 'Authorization: Bearer <supabase-jwt>' \
    --header 'apikey: <anon-or-service-role-key>' \
    --data '{"startDate":"2026-08-01","endDate":"2026-08-31","timezone":"Asia/Tokyo"}'

  なお、Supabase Secrets に次の環境変数を設定してください:
  - GOOGLE_HEALTH_CLIENT_ID
  - GOOGLE_HEALTH_CLIENT_SECRET
  - GOOGLE_HEALTH_REFRESH_TOKEN
*/
