export const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "OAUTH_CANCELLED"
  | "OAUTH_STATE_MISMATCH"
  | "HEALTH_NOT_CONNECTED"
  | "HEALTH_PERMISSION_REQUIRED"
  | "HEALTH_PROVIDER_ERROR"
  | "INVALID_INPUT"
  | "INTERNAL_ERROR";

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

export function successResponse(data: unknown): Response {
  return jsonResponse({ ok: true, data });
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status = 200,
): Response {
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function requestId(): string {
  return crypto.randomUUID();
}

export function safeLog(id: string, status: number, classification: string): void {
  console.error(JSON.stringify({ requestId: id, status, classification }));
}

