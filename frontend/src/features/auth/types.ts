import type { ApiError, ApiErrorCode } from '../../types/common'
import type { UserSummary } from '../../types/user'

export type GoogleIntegrationErrorCode = Extract<
  ApiErrorCode,
  | 'UNAUTHENTICATED'
  | 'OAUTH_CANCELLED'
  | 'OAUTH_STATE_MISMATCH'
  | 'HEALTH_NOT_CONNECTED'
  | 'HEALTH_PERMISSION_REQUIRED'
  | 'HEALTH_PROVIDER_ERROR'
  | 'INVALID_INPUT'
  | 'INTERNAL_ERROR'
>

export type AuthUser = UserSummary & {
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

export type AuthState =
  | { status: 'initializing' }
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: ApiError }

export type StartGoogleHealthConnectionResult =
  | { next: 'redirect'; authorizationUrl: string }
  | { next: 'connected'; state: GoogleIntegrationState }
