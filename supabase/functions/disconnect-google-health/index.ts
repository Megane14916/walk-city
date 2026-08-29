import { errorResponse, optionsResponse, requestId, safeLog, successResponse } from "../_shared/api-response.ts";
import { integrationState } from "../_shared/integration-state.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase-clients.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return errorResponse("INVALID_INPUT", "POST メソッドを使用してください。", 405);
  const id = requestId();
  try {
    const { data, error } = await createUserClient(request).auth.getUser();
    if (error || !data.user) return errorResponse("UNAUTHENTICATED", "認証が必要です。", 401);
    const admin = createAdminClient();
    const { error: disconnectError } = await admin.rpc("disconnect_health_connection", {
      p_user_id: data.user.id,
    });
    if (disconnectError) throw new Error("HEALTH_DISCONNECT_FAILED");
    return successResponse(await integrationState(request, data.user, admin));
  } catch {
    safeLog(id, 500, "DISCONNECT_HEALTH_FAILED");
    return errorResponse("INTERNAL_ERROR", "Google Health 連携を解除できませんでした。", 500);
  }
});

