export const GOOGLE_HEALTH_ACTIVITY_READ_SCOPE =
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly'

export type GoogleIntegrationErrorCode =
  | 'UNAUTHENTICATED'
  | 'OAUTH_CANCELLED'
  | 'OAUTH_STATE_MISMATCH'
  | 'HEALTH_NOT_CONNECTED'
  | 'HEALTH_PERMISSION_REQUIRED'
  | 'HEALTH_PROVIDER_ERROR'
  | 'INVALID_INPUT'
  | 'INTERNAL_ERROR'

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: {
        code: GoogleIntegrationErrorCode
        message: string
        details?: Record<string, unknown>
      }
    }

export type AuthUser = {
  id: string
  displayName: string
  email: string
  avatarUrl: string | null
}

export type AuthSession = {
  user: AuthUser
  expiresAt: string
}

export type GoogleHealthConnection = {
  status: 'connected' | 'not_connected' | 'permission_required'
  scopes: string[]
  connectedAt: string | null
  lastSyncedAt: string | null
}

export type GoogleIntegrationState = {
  session: AuthSession | null
  healthConnection: GoogleHealthConnection | null
}

export type GetDailyStepsInput = {
  date: string
  timezone: string
}

export type DailySteps = {
  date: string
  timezone: string
  steps: number
  source: 'google_health'
  syncedAt: string
}

export type StartGoogleHealthConnectionResult =
  | { next: 'redirect'; authorizationUrl: string }
  | { next: 'connected'; state: GoogleIntegrationState }

/**
 * GoogleログインとGoogle Health連携をUIから利用するための境界。
 * 実装がmockからSupabase/Edge Functionへ変わってもUIはこの型を使う。
 */
export interface GoogleIntegrationApi {
  getState(): Promise<ApiResult<GoogleIntegrationState>>
  signInWithGoogle(): Promise<ApiResult<GoogleIntegrationState>>
  signOut(): Promise<ApiResult<GoogleIntegrationState>>
  startGoogleHealthConnection(): Promise<
    ApiResult<StartGoogleHealthConnectionResult>
  >
  disconnectGoogleHealth(): Promise<ApiResult<GoogleIntegrationState>>
  getDailySteps(
    input: GetDailyStepsInput,
  ): Promise<ApiResult<DailySteps>>
}
