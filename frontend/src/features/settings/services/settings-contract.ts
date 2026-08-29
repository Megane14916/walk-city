import { parseApiResultEnvelope } from '../../../lib/supabase-api'
import type { ApiResult } from '../../../types/common'
import {
  normalizeUserSettingsInput,
  validateUserSettings,
} from '../settings-validation'
import type { UserSettings } from '../types'

const SETTINGS_ERROR_CODES = new Set([
  'UNAUTHENTICATED',
  'INVALID_INPUT',
  'NOT_FOUND',
  'INTERNAL_ERROR',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.includes('T') &&
    !Number.isNaN(Date.parse(value))
  )
}

export function mapUserSettingsRpcData(value: unknown): UserSettings | null {
  if (
    !isRecord(value) ||
    typeof value.display_name !== 'string' ||
    typeof value.town_name !== 'string' ||
    !isValidTimestamp(value.updated_at)
  ) {
    return null
  }

  const input = {
    displayName: value.display_name,
    townName: value.town_name,
  }
  const normalized = normalizeUserSettingsInput(input)
  if (
    normalized.displayName !== input.displayName ||
    normalized.townName !== input.townName ||
    Object.keys(validateUserSettings(input)).length > 0
  ) {
    return null
  }

  return { ...input, updatedAt: value.updated_at }
}

export function parseUserSettingsRpcResult(
  value: unknown,
): ApiResult<UserSettings> {
  const envelope = parseApiResultEnvelope(
    value,
    (data): data is unknown => mapUserSettingsRpcData(data) !== null,
    '設定を保存できませんでした。',
  )
  if (!envelope.ok) {
    return SETTINGS_ERROR_CODES.has(envelope.error.code)
      ? envelope
      : {
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: '設定を保存できませんでした。',
          },
        }
  }

  return {
    ok: true,
    data: mapUserSettingsRpcData(envelope.data) as UserSettings,
  }
}
