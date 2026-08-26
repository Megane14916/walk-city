import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApiErrorCode, ApiResult } from '../../../types/common'
import type { DailySteps, GetDailyStepsInput } from '../../health/types'
import type { GoogleIntegrationApi } from '../api'
import type {
  GoogleIntegrationState,
  StartGoogleHealthConnectionResult,
} from '../types'

export type GoogleIntegrationFunctionNames = {
  getState: string
  startHealthConnection: string
  disconnectHealth: string
  getDailySteps: string
}

export type SupabaseGoogleIntegrationApiOptions = {
  redirectTo?: string
  functionNames?: Partial<GoogleIntegrationFunctionNames>
}

const DEFAULT_FUNCTION_NAMES: GoogleIntegrationFunctionNames = {
  getState: 'get-google-integration-state',
  startHealthConnection: 'begin-google-health-auth',
  disconnectHealth: 'disconnect-google-health',
  getDailySteps: 'get-daily-steps',
}

const API_ERROR_CODES = new Set<ApiErrorCode>([
  'UNAUTHENTICATED',
  'OAUTH_CANCELLED',
  'OAUTH_STATE_MISMATCH',
  'HEALTH_NOT_CONNECTED',
  'HEALTH_PERMISSION_REQUIRED',
  'HEALTH_PROVIDER_ERROR',
  'INVALID_INPUT',
  'CATALOG_ITEM_DISABLED',
  'PRICE_NOT_SET',
  'INSUFFICIENT_COINS',
  'OUT_OF_MAP',
  'LAND_LOCKED',
  'CELL_OCCUPIED',
  'ROAD_REQUIRED',
  'NOT_OWNER',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL_ERROR',
])

const errorMessages: Record<
  'UNAUTHENTICATED' | 'HEALTH_PROVIDER_ERROR' | 'INTERNAL_ERROR',
  string
> = {
  UNAUTHENTICATED: 'Googleでログインしてください。',
  HEALTH_PROVIDER_ERROR: 'Google Healthとの通信に失敗しました。',
  INTERNAL_ERROR: '予期しないエラーが発生しました。',
}

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function failure<T>(
  code: ApiErrorCode,
  message = code in errorMessages
    ? errorMessages[code as keyof typeof errorMessages]
    : '処理を完了できませんでした。',
): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && API_ERROR_CODES.has(value as ApiErrorCode)
}

function isGoogleIntegrationState(
  value: unknown,
): value is GoogleIntegrationState {
  if (!isRecord(value)) return false

  const { session, healthConnection } = value
  const validSession =
    session === null ||
    (isRecord(session) &&
      typeof session.expiresAt === 'string' &&
      isRecord(session.user) &&
      typeof session.user.id === 'string' &&
      typeof session.user.displayName === 'string' &&
      typeof session.user.email === 'string' &&
      isNullableString(session.user.avatarUrl))
  const validHealthConnection =
    healthConnection === null ||
    (isRecord(healthConnection) &&
      (healthConnection.status === 'connected' ||
        healthConnection.status === 'not_connected' ||
        healthConnection.status === 'permission_required') &&
      Array.isArray(healthConnection.scopes) &&
      healthConnection.scopes.every((scope) => typeof scope === 'string') &&
      isNullableString(healthConnection.connectedAt) &&
      isNullableString(healthConnection.lastSyncedAt))

  return validSession && validHealthConnection
}

function isStartGoogleHealthConnectionResult(
  value: unknown,
): value is StartGoogleHealthConnectionResult {
  if (!isRecord(value)) return false
  if (value.next === 'redirect') {
    return typeof value.authorizationUrl === 'string'
  }
  return value.next === 'connected' && isGoogleIntegrationState(value.state)
}

function isDailySteps(value: unknown): value is DailySteps {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    typeof value.timezone === 'string' &&
    typeof value.steps === 'number' &&
    Number.isSafeInteger(value.steps) &&
    value.steps >= 0 &&
    value.source === 'google_health' &&
    typeof value.syncedAt === 'string'
  )
}

function parseFunctionResult<T>(
  value: unknown,
  isData: (data: unknown) => data is T,
  fallbackCode: 'HEALTH_PROVIDER_ERROR' | 'INTERNAL_ERROR',
): ApiResult<T> {
  if (isData(value)) return success(value)

  if (isRecord(value) && value.ok === true && isData(value.data)) {
    return success(value.data)
  }

  if (
    isRecord(value) &&
    value.ok === false &&
    isRecord(value.error) &&
    isApiErrorCode(value.error.code)
  ) {
    const message =
      typeof value.error.message === 'string'
        ? value.error.message
        : undefined
    return failure(value.error.code, message)
  }

  return failure(fallbackCode)
}

export function createSupabaseGoogleIntegrationApi(
  supabase: SupabaseClient,
  options: SupabaseGoogleIntegrationApiOptions = {},
): GoogleIntegrationApi {
  const functionNames = {
    ...DEFAULT_FUNCTION_NAMES,
    ...options.functionNames,
  }

  const invoke = async <T>(
    functionName: string,
    isData: (data: unknown) => data is T,
    fallbackCode: 'HEALTH_PROVIDER_ERROR' | 'INTERNAL_ERROR',
    body?: Record<string, unknown>,
  ): Promise<ApiResult<T>> => {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: body ?? {},
    })
    if (error) return failure(fallbackCode)
    return parseFunctionResult(data, isData, fallbackCode)
  }

  const getGoogleIntegrationState = async (): Promise<
    ApiResult<GoogleIntegrationState>
  > => {
    const { data, error } = await supabase.auth.getSession()
    if (error) return failure('INTERNAL_ERROR')
    if (!data.session) {
      return success({ session: null, healthConnection: null })
    }

    return invoke(
      functionNames.getState,
      isGoogleIntegrationState,
      'INTERNAL_ERROR',
    )
  }

  return {
    getGoogleIntegrationState,

    async signInWithGoogle() {
      const redirectTo =
        options.redirectTo ?? `${globalThis.location.origin}/auth/callback`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) return failure('INTERNAL_ERROR')

      return getGoogleIntegrationState()
    },

    async signOut() {
      const { error } = await supabase.auth.signOut()
      if (error) return failure('INTERNAL_ERROR')
      return success({ session: null, healthConnection: null })
    },

    async startGoogleHealthConnection() {
      return invoke(
        functionNames.startHealthConnection,
        isStartGoogleHealthConnectionResult,
        'HEALTH_PROVIDER_ERROR',
      )
    },

    async disconnectGoogleHealth() {
      return invoke(
        functionNames.disconnectHealth,
        isGoogleIntegrationState,
        'HEALTH_PROVIDER_ERROR',
      )
    },

    async getDailySteps(input: GetDailyStepsInput) {
      return invoke(
        functionNames.getDailySteps,
        isDailySteps,
        'HEALTH_PROVIDER_ERROR',
        input,
      )
    },
  }
}
