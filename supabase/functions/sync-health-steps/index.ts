import { errorResponse, optionsResponse, requestId, safeLog, successResponse } from "../_shared/api-response.ts";
import {
  fetchDailySteps,
  GOOGLE_HEALTH_SCOPE,
  HealthProviderError,
  refreshAccessToken,
  todayInTokyo,
} from "../_shared/google-health-client.ts";
import { decryptRefreshToken } from "../_shared/health-token-crypto.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase-clients.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || !/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return errorResponse("INVALID_INPUT", "POST メソッドを使用してください。", 405);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "リクエストは空の JSON オブジェクトにしてください。", 400);
  }
  if (!isObject(body) || Object.keys(body).length !== 0) {
    return errorResponse("INVALID_INPUT", "body は空オブジェクト {} のみ受け付けます。", 400);
  }

  const id = requestId();
  const { data: userData, error: userError } = await createUserClient(request).auth.getUser();
  if (userError || !userData.user) return errorResponse("UNAUTHENTICATED", "認証が必要です。", 401);

  const userId = userData.user.id;
  const admin = createAdminClient();
  try {
    const { data: connectionData, error: connectionError } = await admin.rpc(
      "get_health_connection",
      { p_user_id: userId },
    );
    if (connectionError) throw new Error("HEALTH_CONNECTION_QUERY_FAILED");
    const connection = isObject(connectionData) ? connectionData : null;
    const scopes = Array.isArray(connection?.scopes)
      ? connection.scopes.filter((scope): scope is string => typeof scope === "string")
      : [];
    if (!connection || connection.status === "not_connected" ||
      typeof connection.encrypted_refresh_token !== "string") {
      return errorResponse("HEALTH_NOT_CONNECTED", "Google Health に未接続です。");
    }
    if (connection.status === "permission_required" || !scopes.includes(GOOGLE_HEALTH_SCOPE)) {
      return errorResponse("HEALTH_PERMISSION_REQUIRED", "Google Health の権限を確認してください。");
    }

    // No database lock is held while calling Google.
    const refreshToken = await decryptRefreshToken(connection.encrypted_refresh_token);
    const accessToken = await refreshAccessToken(refreshToken);
    const date = todayInTokyo();
    const steps = await fetchDailySteps(accessToken, date);

    const { data: rewardData, error: rewardError } = await admin.rpc("sync_step_rewards", {
      p_user_id: userId,
      p_source: "google_health",
      p_records: [{ step_date: date, steps }],
    });
    if (rewardError || !isObject(rewardData) || !Array.isArray(rewardData.records) ||
      !isObject(rewardData.records[0])) {
      throw new Error("STEP_REWARD_SYNC_FAILED");
    }

    const coinsAwarded = nonNegativeInteger(rewardData.coins_awarded);
    const coinBalance = nonNegativeInteger(rewardData.balance);
    const newlyRewardedSteps = nonNegativeInteger(rewardData.records[0].newly_rewarded_steps);
    const syncedAt = rewardData.synced_at;
    if (coinsAwarded === null || coinBalance === null || newlyRewardedSteps === null ||
      typeof syncedAt !== "string") {
      throw new Error("STEP_REWARD_RESPONSE_INVALID");
    }

    const { error: syncStateError } = await admin.rpc("mark_health_synced", {
      p_user_id: userId,
      p_synced_at: syncedAt,
    });
    if (syncStateError) throw new Error("HEALTH_SYNC_STATE_FAILED");

    return successResponse({
      date,
      timezone: "Asia/Tokyo",
      steps,
      newlyRewardedSteps,
      coinsAwarded,
      coinBalance,
      appliedBonuses: [],
      syncedAt,
    });
  } catch (error) {
    if (error instanceof HealthProviderError && error.kind === "permission") {
      await admin.rpc("mark_health_permission_required", { p_user_id: userId });
      safeLog(id, 200, "HEALTH_PERMISSION_REQUIRED");
      return errorResponse("HEALTH_PERMISSION_REQUIRED", "Google Health の権限を確認してください。");
    }
    if (error instanceof HealthProviderError && error.kind === "provider") {
      safeLog(id, 502, "HEALTH_PROVIDER_UNAVAILABLE");
      return errorResponse("HEALTH_PROVIDER_ERROR", "Google Health との通信に失敗しました。", 502);
    }
    safeLog(id, 500, "HEALTH_SYNC_INTERNAL_ERROR");
    return errorResponse("INTERNAL_ERROR", "歩数を同期できませんでした。", 500);
  }
});
