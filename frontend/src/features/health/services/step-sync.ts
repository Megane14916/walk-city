import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type SupabaseClient,
} from '@supabase/supabase-js'
import type {
  ApiError,
  ApiErrorCode,
  ApiResult,
} from '../../../types/common'
import type { StepSyncApi } from '../api'
import type { AppliedBonus, StepSyncStatus } from '../types'

export type SupabaseStepSyncApiOptions = {
  functionName?: string
}

const DEFAULT_FUNCTION_NAME = 'sync-health-steps'
const TIMEZONE = 'Asia/Tokyo'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const MAX_ERROR_MESSAGE_LENGTH = 500

const STEP_SYNC_ERROR_CODES = new Set<ApiErrorCode>([
  'UNAUTHENTICATED',
  'HEALTH_NOT_CONNECTED',
  'HEALTH_PERMISSION_REQUIRED',
  'HEALTH_PROVIDER_ERROR',
  'INVALID_INPUT',
  'CONFLICT',
  'INTERNAL_ERROR',
])

const fallbackMessages: Record<
  | 'UNAUTHENTICATED'
  | 'HEALTH_PROVIDER_ERROR'
  | 'INTERNAL_ERROR',
  string
> = {
  UNAUTHENTICATED: 'Googleでログインしてください。',
  HEALTH_PROVIDER_ERROR: 'Google Healthとの通信に失敗しました。',
  INTERNAL_ERROR: '歩数を同期できませんでした。',
}

function success(data: StepSyncStatus): ApiResult<StepSyncStatus> {
  return { ok: true, data }
}

function failure(
  code: keyof typeof fallbackMessages,
): ApiResult<StepSyncStatus> {
  return { ok: false, error: { code, message: fallbackMessages[code] } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false

  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  )
}

function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_DATE_TIME_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

function isAppliedBonus(value: unknown): value is AppliedBonus {
  if (!isRecord(value)) return false

  return (
    isNonEmptyString(value.sourceBuildingType) &&
    isNonNegativeSafeInteger(value.sourceCount) &&
    isNonEmptyString(value.effectType) &&
    isNonNegativeSafeInteger(value.amount)
  )
}

export function isStepSyncStatus(value: unknown): value is StepSyncStatus {
  if (!isRecord(value)) return false

  return (
    isCalendarDate(value.date) &&
    value.timezone === TIMEZONE &&
    isNonNegativeSafeInteger(value.steps) &&
    isNonNegativeSafeInteger(value.newlyRewardedSteps) &&
    value.newlyRewardedSteps <= value.steps &&
    isNonNegativeSafeInteger(value.coinsAwarded) &&
    isNonNegativeSafeInteger(value.coinBalance) &&
    Array.isArray(value.appliedBonuses) &&
    value.appliedBonuses.every(isAppliedBonus) &&
    isIsoDateTime(value.syncedAt)
  )
}

function isStepSyncErrorCode(value: unknown): value is ApiErrorCode {
  return (
    typeof value === 'string' &&
    STEP_SYNC_ERROR_CODES.has(value as ApiErrorCode)
  )
}

function parseError(value: unknown): ApiError | null {
  if (
    !isRecord(value) ||
    value.ok !== false ||
    !isRecord(value.error) ||
    !isStepSyncErrorCode(value.error.code)
  ) {
    return null
  }

  const message = value.error.message
  if (
    typeof message !== 'string' ||
    message.trim().length === 0 ||
    message.length > MAX_ERROR_MESSAGE_LENGTH
  ) {
    return null
  }

  return { code: value.error.code, message }
}

export function parseStepSyncResult(
  value: unknown,
): ApiResult<StepSyncStatus> {
  if (
    isRecord(value) &&
    value.ok === true &&
    isStepSyncStatus(value.data)
  ) {
    return success(value.data)
  }

  const error = parseError(value)
  return error ? { ok: false, error } : failure('INTERNAL_ERROR')
}

function statusFromContext(context: unknown): number | null {
  if (!isRecord(context)) return null
  return typeof context.status === 'number' ? context.status : null
}

async function errorBodyFromContext(context: unknown): Promise<unknown> {
  if (!isRecord(context)) return null

  const clone = context.clone
  if (typeof clone === 'function') {
    try {
      const response = clone.call(context) as { json?: () => Promise<unknown> }
      if (typeof response.json === 'function') return await response.json()
    } catch {
      return null
    }
  }

  const json = context.json
  if (typeof json !== 'function') return null

  try {
    return await (json.call(context) as Promise<unknown>)
  } catch {
    return null
  }
}

async function normalizeInvokeError(
  error: unknown,
): Promise<ApiResult<StepSyncStatus>> {
  if (error instanceof FunctionsHttpError) {
    const body = await errorBodyFromContext(error.context)
    const apiError = parseError(body)
    if (apiError) return { ok: false, error: apiError }

    return statusFromContext(error.context) === 401
      ? failure('UNAUTHENTICATED')
      : failure('INTERNAL_ERROR')
  }

  if (
    error instanceof FunctionsFetchError ||
    error instanceof FunctionsRelayError
  ) {
    return failure('HEALTH_PROVIDER_ERROR')
  }

  return failure('INTERNAL_ERROR')
}

export function createSupabaseStepSyncApi(
  supabase: SupabaseClient,
  options: SupabaseStepSyncApiOptions = {},
): StepSyncApi {
  const functionName = options.functionName ?? DEFAULT_FUNCTION_NAME

  return {
    async syncSteps() {
      try {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: {},
        })

        if (error) return normalizeInvokeError(error)
        return parseStepSyncResult(data)
      } catch {
        return failure('HEALTH_PROVIDER_ERROR')
      }
    },
  }
}
