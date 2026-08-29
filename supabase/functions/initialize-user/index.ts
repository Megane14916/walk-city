import { errorResponse, optionsResponse, requestId, safeLog, successResponse } from "../_shared/api-response.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase-clients.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return errorResponse("INVALID_INPUT", "POST メソッドを使用してください。", 405);
  const id = requestId();
  try {
    const { data: userData, error: userError } = await createUserClient(request).auth.getUser();
    if (userError || !userData.user) return errorResponse("UNAUTHENTICATED", "認証が必要です。", 401);

    const { data, error } = await createAdminClient().rpc("initialize_user", {
      p_user_id: userData.user.id,
    });
    if (error || !isObject(data) || typeof data.profile_id !== "string" ||
      typeof data.town_id !== "string" || typeof data.created !== "boolean") {
      throw new Error("USER_INITIALIZATION_FAILED");
    }
    return successResponse({
      profileId: data.profile_id,
      townId: data.town_id,
      created: data.created,
    });
  } catch {
    safeLog(id, 500, "INITIALIZE_USER_FAILED");
    return errorResponse("INTERNAL_ERROR", "初期化に失敗しました。", 500);
  }
});
