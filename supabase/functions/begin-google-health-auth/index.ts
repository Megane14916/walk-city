import { errorResponse, optionsResponse, requestId, safeLog, successResponse } from "../_shared/api-response.ts";
import { authorizationUrl } from "../_shared/google-health-client.ts";
import { randomState, sha256Hex } from "../_shared/health-token-crypto.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase-clients.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return errorResponse("INVALID_INPUT", "POST メソッドを使用してください。", 405);

  const id = requestId();
  try {
    const { data, error } = await createUserClient(request).auth.getUser();
    if (error || !data.user) return errorResponse("UNAUTHENTICATED", "認証が必要です。", 401);

    const successRedirectUrl = Deno.env.get("HEALTH_OAUTH_SUCCESS_URL")?.trim() ||
      "http://localhost:5173/health/connect";
    const redirect = new URL(successRedirectUrl);
    if (redirect.protocol !== "https:" && redirect.hostname !== "localhost") {
      throw new Error("INVALID_SUCCESS_REDIRECT");
    }

    const state = randomState();
    const { error: stateError } = await createAdminClient().rpc("store_health_oauth_state", {
      p_user_id: data.user.id,
      p_state_hash: await sha256Hex(state),
      p_success_redirect_url: redirect.toString(),
    });
    if (stateError) throw new Error("OAUTH_STATE_STORE_FAILED");

    return successResponse({ next: "redirect", authorizationUrl: authorizationUrl(state) });
  } catch {
    safeLog(id, 500, "BEGIN_HEALTH_AUTH_FAILED");
    return errorResponse("INTERNAL_ERROR", "Google Health 連携を開始できませんでした。", 500);
  }
});

