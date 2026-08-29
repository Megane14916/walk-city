import type { ApiError, ApiErrorCode, ApiResult } from '../types/common'

const MAX_SERVER_MESSAGE_LENGTH = 500

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
  'AREA_ALREADY_UNLOCKED',
  'AREA_NOT_ADJACENT',
  'NOT_OWNER',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL_ERROR',
])

const SAFE_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  UNAUTHENTICATED: 'Googleでログインしてください。',
  INVALID_INPUT: '入力内容を確認してください。',
  NOT_OWNER: 'この操作を行う権限がありません。',
  NOT_FOUND: '対象が見つかりませんでした。',
  CONFLICT: 'データが更新されています。もう一度お試しください。',
}

const POSTGRES_CODE_MAP: Record<string, ApiErrorCode> = {
  '22P02': 'INVALID_INPUT',
  '22003': 'INVALID_INPUT',
  '23503': 'INVALID_INPUT',
  '23505': 'CONFLICT',
  '23514': 'INVALID_INPUT',
  '42501': 'NOT_OWNER',
  PGRST116: 'NOT_FOUND',
}

type ErrorNormalizationOptions = {
  fallbackMessage: string
  fallbackCode?: ApiErrorCode
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    typeof value === 'string' &&
    API_ERROR_CODES.has(value as ApiErrorCode)
  )
}

function isSafeServerMessage(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= MAX_SERVER_MESSAGE_LENGTH
  )
}

function safeMessage(code: ApiErrorCode, fallbackMessage: string): string {
  return SAFE_MESSAGES[code] ?? fallbackMessage
}

function errorFromEnvelope(value: unknown): ApiError | null {
  if (
    !isRecord(value) ||
    value.ok !== false ||
    !isRecord(value.error) ||
    !isApiErrorCode(value.error.code)
  ) {
    return null
  }

  const code = value.error.code
  return {
    code,
    message: isSafeServerMessage(value.error.message)
      ? value.error.message
      : safeMessage(code, '処理を完了できませんでした。'),
  }
}

function statusFromValue(value: unknown): number | null {
  if (!isRecord(value)) return null
  if (typeof value.status === 'number') return value.status
  if (isRecord(value.context) && typeof value.context.status === 'number') {
    return value.context.status
  }
  return null
}

function codeFromStatus(status: number | null): ApiErrorCode | null {
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 403) return 'NOT_OWNER'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status !== null && status >= 400 && status < 500) {
    return 'INVALID_INPUT'
  }
  return null
}

async function readJsonFromResponseLike(value: unknown): Promise<unknown> {
  if (!isRecord(value)) return null

  const clone = value.clone
  if (typeof clone === 'function') {
    try {
      const cloned = clone.call(value) as { json?: () => Promise<unknown> }
      if (typeof cloned.json === 'function') return await cloned.json()
    } catch {
      return null
    }
  }

  if (typeof value.json !== 'function') return null
  try {
    return await (value.json.call(value) as Promise<unknown>)
  } catch {
    return null
  }
}

async function errorBody(value: unknown): Promise<unknown> {
  if (!isRecord(value)) return null
  if (value.context !== undefined) {
    return readJsonFromResponseLike(value.context)
  }
  return readJsonFromResponseLike(value)
}

function postgresErrorCode(value: unknown): ApiErrorCode | null {
  if (!isRecord(value) || typeof value.code !== 'string') return null
  return POSTGRES_CODE_MAP[value.code] ?? null
}

export async function normalizeSupabaseError(
  error: unknown,
  options: ErrorNormalizationOptions,
): Promise<ApiError> {
  const directEnvelope = errorFromEnvelope(error)
  if (directEnvelope) return directEnvelope

  const body = await errorBody(error)
  const bodyEnvelope = errorFromEnvelope(body)
  if (bodyEnvelope) return bodyEnvelope

  const code =
    postgresErrorCode(error) ??
    codeFromStatus(statusFromValue(error)) ??
    options.fallbackCode ??
    'INTERNAL_ERROR'

  return {
    code,
    message: safeMessage(code, options.fallbackMessage),
  }
}

export function parseApiResultEnvelope<T>(
  value: unknown,
  isData: (data: unknown) => data is T,
  fallbackMessage: string,
): ApiResult<T> {
  if (isRecord(value) && value.ok === true && isData(value.data)) {
    return { ok: true, data: value.data }
  }

  const apiError = errorFromEnvelope(value)
  if (apiError) return { ok: false, error: apiError }

  return {
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: fallbackMessage },
  }
}

export async function supabaseFailure<T>(
  error: unknown,
  options: ErrorNormalizationOptions,
): Promise<ApiResult<T>> {
  return { ok: false, error: await normalizeSupabaseError(error, options) }
}
