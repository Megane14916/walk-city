import type { StepSyncApi } from '../../features/health/api'
import type { StepSyncStatus } from '../../features/health/types'
import type { ApiErrorCode, ApiResult } from '../../types/common'
import {
  createMockWalkCityStore,
  mockWalkCityStore,
  type MockWalkCityStore,
} from './walk-city-store'

export type MockStepSyncOperation = 'syncSteps'

export type MockStepSyncErrorCode = Extract<
  ApiErrorCode,
  | 'UNAUTHENTICATED'
  | 'HEALTH_NOT_CONNECTED'
  | 'HEALTH_PERMISSION_REQUIRED'
  | 'HEALTH_PROVIDER_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
>

export type MockStepSyncApiOptions = {
  latencyMs?: number
  now?: () => Date
  store?: MockWalkCityStore
  coinsPerStep?: number
}

export type MockStepSyncApi = StepSyncApi & {
  setFailure(code: MockStepSyncErrorCode | null): void
  setSteps(date: string, steps: number): void
  reset(): void
}

const TIMEZONE = 'Asia/Tokyo'
const errorMessages: Record<MockStepSyncErrorCode, string> = {
  UNAUTHENTICATED: 'Googleでログインしてください。',
  HEALTH_NOT_CONNECTED: 'Google Healthが連携されていません。',
  HEALTH_PERMISSION_REQUIRED: '歩数を読み取る権限が必要です。',
  HEALTH_PROVIDER_ERROR: 'Google Healthとの通信に失敗しました。',
  CONFLICT: '歩数の同期状態が更新されました。もう一度お試しください。',
  INTERNAL_ERROR: '歩数を同期できませんでした。',
}

function success(data: StepSyncStatus): ApiResult<StepSyncStatus> {
  return { ok: true, data }
}

function failure(code: MockStepSyncErrorCode): ApiResult<StepSyncStatus> {
  return { ok: false, error: { code, message: errorMessages[code] } }
}

function dateInTokyo(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function createMockStepSyncApi(
  options: MockStepSyncApiOptions = {},
): MockStepSyncApi {
  const latencyMs = options.latencyMs ?? 150
  const now = options.now ?? (() => new Date())
  const store = options.store ?? createMockWalkCityStore()
  const coinsPerStep = options.coinsPerStep ?? 0.1
  let configuredFailure: MockStepSyncErrorCode | null = null

  if (!Number.isFinite(coinsPerStep) || coinsPerStep < 0) {
    throw new Error('coinsPerStepは0以上の有限数にしてください。')
  }

  const wait = async () => {
    if (latencyMs <= 0) return
    await new Promise<void>((resolve) =>
      globalThis.setTimeout(resolve, latencyMs),
    )
  }

  return {
    async syncSteps() {
      await wait()
      if (configuredFailure) return failure(configuredFailure)

      const timestamp = now()
      const date = dateInTokyo(timestamp)
      const steps = store.getSteps(date)
      const rewardedSteps = store.getRewardedSteps(date)
      const newlyRewardedSteps = Math.max(0, steps - rewardedSteps)
      const coinsAwarded = Math.max(
        0,
        Math.floor(steps * coinsPerStep) -
          Math.floor(rewardedSteps * coinsPerStep),
      )
      const coinBalance = store.awardCoins(coinsAwarded)
      if (coinBalance === null) return failure('INTERNAL_ERROR')

      store.setRewardedSteps(date, Math.max(rewardedSteps, steps))

      return success({
        date,
        timezone: TIMEZONE,
        steps,
        newlyRewardedSteps,
        coinsAwarded,
        coinBalance,
        appliedBonuses: [],
        syncedAt: timestamp.toISOString(),
      })
    },

    setFailure(code) {
      configuredFailure = code
    },

    setSteps(date, steps) {
      store.setSteps(date, steps)
    },

    reset() {
      configuredFailure = null
      store.reset()
    },
  }
}

export const mockStepSyncApi = createMockStepSyncApi({
  store: mockWalkCityStore,
})
