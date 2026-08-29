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

type ZonedDateTimeParts = {
  date: DateValue;
  time: TimeValue;
};

// `YYYY-MM-DD` を DateValue に変換する。
function parseDateValue(value: string): DateValue | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

// 任意TZで現在時刻を分解し、日付と時刻を安全に得る。
function getZonedDateTimeParts(date: Date, timezone: string): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((item) => item.type === type)?.value;
    return part ? Number(part) : Number.NaN;
  };
  const year = read("year");
  const month = read("month");
  const day = read("day");
  const hours = read("hour");
  const minutes = read("minute");
  const seconds = read("second");
  if ([year, month, day, hours, minutes, seconds].some((value) => !Number.isFinite(value))) {
    throw new Error("タイムゾーンの時刻解決に失敗しました。");
  }
  return {
    date: { year, month, day },
    time: { hours, minutes, seconds, nanos: 0 },
  };
}

// 日付を `YYYY-MM-DD` 形式の文字列へ変換する。
function formatDate(date: DateValue): string {
  return `${date.year}-${`${date.month}`.padStart(2, "0")}-${`${date.day}`.padStart(2, "0")}`;
}

function isSameDate(left: DateValue, right: DateValue): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day;
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

// Google OAuth の refresh token を使って有効な access token を取得する。
// これは Google Health API を呼ぶための「短時間有効な鍵」である。
async function getGoogleAccessToken(refreshToken: string): Promise<string> {
  // Supabase の Secrets から Google の認証情報を取得する。
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Health OAuthの情報が登録されていません。Supabase Secrets に GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET を設定してください。",
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
  timezone: string,
) {
  // 1日分のみ取得するため、対象日は startDate を優先する。
  const dateValue = parseDateValue(startDate || endDate);
  if (!dateValue) {
    throw new Error("日付形式が不正です。YYYY-MM-DD で指定してください。");
  }
  const nowInTimezone = getZonedDateTimeParts(new Date(Date.now() - 1_000), timezone);
  const todayText = formatDate(nowInTimezone.date);
  const targetText = formatDate(dateValue);
  const isFutureDate = targetText > todayText;
  const endTime: TimeValue = isFutureDate
    ? { hours: 0, minutes: 0, seconds: 0, nanos: 0 }
    : isSameDate(dateValue, nowInTimezone.date)
    ? nowInTimezone.time
    : { hours: 23, minutes: 59, seconds: 59, nanos: 0 };

  // Google Health API のリクエスト形式に合わせて 1日レンジを組み立てる。
  const body = {
    range: {
      start: {
        date: dateValue,
        time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 },
      },
      end: {
        date: dateValue,
        time: endTime,
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
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    const { data: userData, error: userError } = await ctx.supabase.auth.getUser();
    if (userError || !userData.user) {
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
    const userId = userData.user.id;

    // リクエスト本文から期間とタイムゾーンを拾う。
    // JSON が不正でも失敗させずにデフォルト値を使う。
    let payload: RequestBody = {};
    try {
      payload = (await req.json()) as RequestBody;
    } catch {
      payload = {};
    }

    const timezone = payload.timezone ?? DEFAULT_TIMEZONE;
    let currentDate: DateValue;
    try {
      currentDate = getZonedDateTimeParts(new Date(), timezone).date;
    } catch (error) {
      return Response.json(
        {
          status: "error",
          code: "INVALID_INPUT",
          message: error instanceof Error ? error.message : "timezone の指定が不正です。",
        },
        {
          status: 400,
        },
      );
    }
    const startDate = payload.startDate ?? formatDate(currentDate);
    const endDate = payload.endDate ?? startDate;

    try {
      const { data: connection, error: connectionError } = await ctx.supabaseAdmin
        .from("health_connections")
        .select("refresh_token")
        .eq("user_id", userId)
        .eq("provider", "google_health")
        .maybeSingle();
      if (connectionError) {
        throw new Error(`Google Health連携情報の取得に失敗しました: ${connectionError.message}`);
      }
      if (!connection?.refresh_token) {
        return Response.json(
          {
            status: "error",
            code: "GOOGLE_HEALTH_CONNECTION_REQUIRED",
            message: "Google Healthの連携情報が見つかりません。",
          },
          {
            status: 403,
          },
        );
      }

      // ユーザー固有の refresh token から access token を取得して、歩数データを取得する。
      const accessToken = await getGoogleAccessToken(connection.refresh_token);
      const data = await fetchStepsFromGoogleHealth(accessToken, startDate, endDate, timezone);

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
  - GOOGLE_CLIENT_ID
  - GOOGLE_CLIENT_SECRET
  また、`health_connections` テーブルに `provider = google_health` の refresh token をユーザー単位で保存してください。
*/
