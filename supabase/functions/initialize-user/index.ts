import { withSupabase } from "@supabase/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function errorResponse(
  code: string,
  message: string,
  status = 200,
  details?: Record<string, unknown>,
): Response {
  const error: ApiError = { code, message };
  if (details) {
    error.details = details;
  }
  return jsonResponse({ ok: false, error }, status);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
      return errorResponse("INVALID_INPUT", "POST メソッドを使用してください。", 405);
    }

    const { data: userData, error: userError } = await ctx.supabase.auth.getUser();
    if (userError || !userData.user) {
      return errorResponse("UNAUTHENTICATED", "認証が必要です。", 401);
    }

    const userId = userData.user.id;
    const requestId = crypto.randomUUID();

    try {
      const supabaseAdmin = ctx.supabaseAdmin as unknown as {
        rpc: (functionName: string, args: Record<string, unknown>) => Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
      };

      const { data, error } = await supabaseAdmin.rpc("initialize_user", {
        p_user_id: userId,
      });

      if (error) {
        console.error(
          JSON.stringify({
            requestId,
            status: 500,
            classification: "INITIALIZE_USER_DB_ERROR",
          }),
        );
        return errorResponse("INTERNAL_ERROR", "初期化に失敗しました。", 500);
      }

      const payload = data as Record<string, unknown> | null;
      const profileId = asString(payload?.profile_id) ?? asString(payload?.profileId) ?? userId;
      const townId = asString(payload?.town_id) ?? asString(payload?.townId) ?? null;
      const created = asBoolean(payload?.created);

      return jsonResponse({
        ok: true,
        data: {
          profileId,
          townId,
          created,
        },
      });
    } catch {
      console.error(
        JSON.stringify({
          requestId,
          status: 500,
          classification: "INITIALIZE_USER_UNEXPECTED_ERROR",
        }),
      );
      return errorResponse("INTERNAL_ERROR", "初期化に失敗しました。", 500);
    }
  }),
};
