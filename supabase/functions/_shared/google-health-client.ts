import { parseDailySteps } from "./google-health-parser.ts";

export const GOOGLE_HEALTH_SCOPE =
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";
export const GOOGLE_HEALTH_DAILY_ROLLUP_URL =
  "https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp";

export class HealthProviderError extends Error {
  constructor(
    public readonly kind: "permission" | "provider" | "configuration",
  ) {
    super(kind);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function jsonOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function googleErrorReason(payload: unknown): string | null {
  if (!isObject(payload) || !isObject(payload.error)) return null;
  const details = payload.error.details;
  if (!Array.isArray(details)) return null;
  for (const detail of details) {
    if (isObject(detail) && typeof detail.reason === "string") return detail.reason;
  }
  return typeof payload.error.status === "string" ? payload.error.status : null;
}

export function googleHealthClientConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = Deno.env.get("GOOGLE_HEALTH_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("GOOGLE_HEALTH_CLIENT_SECRET")?.trim();
  const redirectUri = Deno.env.get("GOOGLE_HEALTH_REDIRECT_URI")?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new HealthProviderError("configuration");
  }
  return { clientId, clientSecret, redirectUri };
}

export function authorizationUrl(state: string): string {
  const { clientId, redirectUri } = googleHealthClientConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_HEALTH_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return url.toString();
}

type TokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
};

async function tokenRequest(params: URLSearchParams): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new HealthProviderError("provider");
  }
  const payload = await jsonOrNull(response);
  if (!response.ok || !isObject(payload)) {
    throw new HealthProviderError(response.status === 400 ? "permission" : "provider");
  }
  return payload as TokenResponse;
}

export async function exchangeAuthorizationCode(code: string): Promise<{
  refreshToken: string;
  scopes: string[];
}> {
  const { clientId, clientSecret, redirectUri } = googleHealthClientConfig();
  const payload = await tokenRequest(new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code,
  }));
  if (typeof payload.refresh_token !== "string" || !payload.refresh_token) {
    throw new HealthProviderError("permission");
  }
  const scopes = typeof payload.scope === "string"
    ? payload.scope.split(/\s+/u).filter(Boolean)
    : [];
  if (!scopes.includes(GOOGLE_HEALTH_SCOPE)) {
    throw new HealthProviderError("permission");
  }
  return { refreshToken: payload.refresh_token, scopes };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = googleHealthClientConfig();
  const payload = await tokenRequest(new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }));
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new HealthProviderError("provider");
  }
  return payload.access_token;
}

function dateParts(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  if (!match) throw new HealthProviderError("provider");
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function nextDate(date: string): { year: number; month: number; day: number } {
  const parts = dateParts(date);
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

export async function fetchDailySteps(accessToken: string, date: string): Promise<number> {
  const startDate = dateParts(date);
  const endDate = nextDate(date);
  let response: Response;
  try {
    response = await fetch(GOOGLE_HEALTH_DAILY_ROLLUP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        range: {
          start: { date: startDate, time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 } },
          end: { date: endDate, time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 } },
        },
        windowSizeDays: 1,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new HealthProviderError("provider");
  }
  const payload = await jsonOrNull(response);
  if (!response.ok) {
    const reason = googleErrorReason(payload);
    throw new HealthProviderError(
      response.status === 401 || response.status === 403 || reason === "MISSING_OAUTH_SCOPE"
        ? "permission"
        : "provider",
    );
  }
  try {
    return parseDailySteps(payload);
  } catch {
    throw new HealthProviderError("provider");
  }
}

export function todayInTokyo(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
