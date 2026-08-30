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

function areAppliedBonuses(
  value: unknown,
  coinsAwarded: number,
): value is AppliedBonus[] {
  if (!Array.isArray(value) || value.length > 2) return false
  if (coinsAwarded === 0 && value.length !== 0) return false

  const bonuses = value.filter(isRecord)
  if (bonuses.length !== value.length) return false
  if (
    bonuses.some(
      (bonus) =>
        (bonus.sourceBuildingType !== 'commercial' &&
          bonus.sourceBuildingType !== 'factory') ||
        !Number.isSafeInteger(bonus.sourceCount) ||
        (bonus.sourceCount as number) <= 0 ||
        bonus.effectType !== 'step_coin_bonus_percent' ||
        !Number.isSafeInteger(bonus.amount) ||
        (bonus.amount as number) <= 0,
    )
  ) {
    return false
  }

  const commercialIndex = bonuses.findIndex(
    (bonus) => bonus.sourceBuildingType === 'commercial',
  )
  const factoryIndex = bonuses.findIndex(
    (bonus) => bonus.sourceBuildingType === 'factory',
  )
  if (
    bonuses.filter((bonus) => bonus.sourceBuildingType === 'commercial')
      .length > 1 ||
    bonuses.filter((bonus) => bonus.sourceBuildingType === 'factory').length >
      1 ||
    (commercialIndex >= 0 && factoryIndex >= 0 && commercialIndex > factoryIndex)
  ) {
    return false
  }

  const commercialAmount =
    commercialIndex < 0
      ? 0
      : Math.min(bonuses[commercialIndex].sourceCount as number, 3) * 10
  if (
    commercialIndex >= 0 &&
    bonuses[commercialIndex].amount !== commercialAmount
  ) {
    return false
  }

  const factoryAmount =
    factoryIndex < 0
      ? 0
      : Math.min(
          Math.min(bonuses[factoryIndex].sourceCount as number, 2) * 25,
          50 - commercialAmount,
        )
  return factoryIndex < 0 || bonuses[factoryIndex].amount === factoryAmount
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
    areAppliedBonuses(value.appliedBonuses, value.coinsAwarded as number) &&
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
