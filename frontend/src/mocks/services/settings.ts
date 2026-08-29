import type { SettingsApi } from '../../features/settings/api'
import {
  normalizeUserSettingsInput,
  validateUserSettings,
} from '../../features/settings/settings-validation'
import type { UserSettings } from '../../features/settings/types'
import type { ApiErrorCode, ApiResult } from '../../types/common'
import {
  createMockWalkCityStore,
  mockWalkCityStore,
  type MockWalkCityStore,
} from './walk-city-store'

export type SettingsMockErrorCode = Extract<
  ApiErrorCode,
  'UNAUTHENTICATED' | 'INVALID_INPUT' | 'NOT_FOUND' | 'INTERNAL_ERROR'
>

export type MockSettingsApiOptions = {
  latencyMs?: number
  now?: () => Date
  store?: MockWalkCityStore
}

export type MockSettingsApi = SettingsApi & {
  setFailure(code: SettingsMockErrorCode | null): void
  setException(enabled: boolean): void
  reset(): void
}

const errorMessages: Record<SettingsMockErrorCode, string> = {
  UNAUTHENTICATED: 'Googleでログインしてください。',
  INVALID_INPUT: '入力内容を確認してください。',
  NOT_FOUND: 'ユーザーまたは街の情報が見つかりませんでした。',
  INTERNAL_ERROR: '設定を保存できませんでした。',
}

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function failure<T>(code: SettingsMockErrorCode): ApiResult<T> {
  return { ok: false, error: { code, message: errorMessages[code] } }
}

export function createMockSettingsApi(
  options: MockSettingsApiOptions = {},
): MockSettingsApi {
  const latencyMs = options.latencyMs ?? 150
  const now = options.now ?? (() => new Date())
  const store = options.store ?? createMockWalkCityStore()
  let nextFailure: SettingsMockErrorCode | null = null
  let shouldThrow = false

  const wait = async () => {
    if (latencyMs <= 0) return
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, latencyMs))
  }

  return {
    async updateUserSettings(input) {
      await wait()
      if (shouldThrow) {
        shouldThrow = false
        throw new Error('Mock updateUserSettings exception')
      }
      if (nextFailure) {
        const code = nextFailure
        nextFailure = null
        return failure(code)
      }

      const normalized = normalizeUserSettingsInput(input)
      if (Object.keys(validateUserSettings(normalized)).length > 0) {
        return failure('INVALID_INPUT')
      }

      store.setUserSettings(normalized.displayName, normalized.townName)
      const settings: UserSettings = {
        ...normalized,
        updatedAt: now().toISOString(),
      }
      return success(settings)
    },

    setFailure(code) {
      nextFailure = code
    },

    setException(enabled) {
      shouldThrow = enabled
    },

    reset() {
      nextFailure = null
      shouldThrow = false
      store.reset()
    },
  }
}

export const mockSettingsApi = createMockSettingsApi({ store: mockWalkCityStore })
