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
    return successResponse(await integrationState(request, data.user, createAdminClient()));
  } catch {
    safeLog(id, 500, "GOOGLE_INTEGRATION_STATE_FAILED");
    return errorResponse("INTERNAL_ERROR", "連携状態を取得できませんでした。", 500);
  }
});

