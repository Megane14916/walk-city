import { requestId, safeLog } from "../_shared/api-response.ts";
import { exchangeAuthorizationCode, HealthProviderError } from "../_shared/google-health-client.ts";
import { encryptRefreshToken, sha256Hex } from "../_shared/health-token-crypto.ts";
import { createAdminClient } from "../_shared/supabase-clients.ts";

function fallbackRedirect(): URL {
  return new URL(
    Deno.env.get("HEALTH_OAUTH_SUCCESS_URL")?.trim() ||
      "http://localhost:5173/health/connect",
  );
}

function redirectWith(url: URL, key: string, value: string): Response {
  url.searchParams.set(key, value);
  return Response.redirect(url, 302);
}

Deno.serve(async (request) => {
  const id = requestId();
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  if (!state) return redirectWith(fallbackRedirect(), "health_error", "OAUTH_STATE_MISMATCH");

  const admin = createAdminClient();
  const { data: stateData, error: stateError } = await admin.rpc("consume_health_oauth_state", {
    p_state_hash: await sha256Hex(state),
  });
  if (stateError || !stateData || typeof stateData !== "object") {
    safeLog(id, 400, "HEALTH_OAUTH_STATE_INVALID");
    return redirectWith(fallbackRedirect(), "health_error", "OAUTH_STATE_MISMATCH");
  }

  const stateRecord = stateData as { user_id?: unknown; success_redirect_url?: unknown };
  const successUrl = typeof stateRecord.success_redirect_url === "string"
    ? new URL(stateRecord.success_redirect_url)
    : fallbackRedirect();
  if (requestUrl.searchParams.get("error") === "access_denied") {
    return redirectWith(successUrl, "health_error", "OAUTH_CANCELLED");
  }

  const code = requestUrl.searchParams.get("code");
  if (!code || typeof stateRecord.user_id !== "string") {
    return redirectWith(successUrl, "health_error", "OAUTH_STATE_MISMATCH");
  }

  try {
    const token = await exchangeAuthorizationCode(code);
    const encrypted = await encryptRefreshToken(token.refreshToken);
    const { error } = await admin.rpc("upsert_health_connection", {
      p_user_id: stateRecord.user_id,
      p_encrypted_refresh_token: encrypted,
      p_scopes: token.scopes,
    });
    if (error) throw new Error("HEALTH_CONNECTION_STORE_FAILED");
    return redirectWith(successUrl, "health", "connected");
  } catch (error) {
    if (error instanceof HealthProviderError && error.kind === "permission") {
      safeLog(id, 200, "HEALTH_OAUTH_PERMISSION_REQUIRED");
      return redirectWith(successUrl, "health_error", "HEALTH_PERMISSION_REQUIRED");
    }
    safeLog(id, 502, "HEALTH_OAUTH_EXCHANGE_FAILED");
    return redirectWith(successUrl, "health_error", "HEALTH_PROVIDER_ERROR");
  }
});
