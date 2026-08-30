function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableTimestamp(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function tokenExpiry(request: Request): string {
  try {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/iu, "");
    const payloadText = token?.split(".")[1];
    if (payloadText) {
      const normalized = payloadText.replaceAll("-", "+").replaceAll("_", "/");
      const payload = JSON.parse(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)));
      if (typeof payload.exp === "number") return new Date(payload.exp * 1000).toISOString();
    }
  } catch {
    // A valid user has already been established; expiry is display-only metadata.
  }
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

export async function integrationState(
  request: Request,
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  },
  admin: {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
    from: (table: "profiles") => {
      select: (columns: "display_name") => {
        eq: (column: "id", value: string) => {
          maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
        };
      };
    };
  },
) {
  const [{ data, error }, profileResult] = await Promise.all([
    admin.rpc("get_health_connection", { p_user_id: user.id }),
    admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  if (error) throw new Error("HEALTH_STATE_QUERY_FAILED");
  if (profileResult.error) throw new Error("PROFILE_QUERY_FAILED");
  const connection = isObject(data) ? data : null;
  const profile = isObject(profileResult.data) ? profileResult.data : null;
  const metadata = isObject(user.user_metadata) ? user.user_metadata : {};
  const displayName = typeof profile?.display_name === "string" && profile.display_name
    ? profile.display_name
    : [metadata.full_name, metadata.name, metadata.user_name]
      .find((value) => typeof value === "string" && value.trim()) ??
      user.email?.split("@")[0] ?? `user-${user.id.replaceAll("-", "").slice(0, 8)}`;
  const avatar = [metadata.avatar_url, metadata.picture]
    .find((value) => typeof value === "string" && value.trim());

  const status = connection?.status === "connected" &&
      typeof connection.encrypted_refresh_token === "string"
    ? "connected"
    : connection?.status === "permission_required"
    ? "permission_required"
    : "not_connected";
  const scopes = Array.isArray(connection?.scopes)
    ? connection.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];

  return {
    session: {
      user: {
        id: user.id,
        displayName: String(displayName),
        email: user.email ?? "",
        avatarUrl: typeof avatar === "string" ? avatar : null,
      },
      expiresAt: tokenExpiry(request),
    },
    healthConnection: {
      status,
      scopes: status === "not_connected" ? [] : scopes,
      connectedAt: status === "not_connected" ? null : nullableTimestamp(connection?.connected_at),
      lastSyncedAt: status === "not_connected" ? null : nullableTimestamp(connection?.last_synced_at),
    },
  };
}

