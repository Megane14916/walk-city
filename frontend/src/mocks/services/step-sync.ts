import type { StepSyncApi } from '../../features/health/api'
import type {
  AppliedBonus,
  StepSyncStatus,
} from '../../features/health/types'
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
const COMMERCIAL_BONUS_PERCENT = 10
const COMMERCIAL_MAX_COUNT = 3
const FACTORY_BONUS_PERCENT = 25
const FACTORY_MAX_COUNT = 2
const COMBINED_BONUS_CAP_PERCENT = 50
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

function calculateAppliedBonuses(
  store: MockWalkCityStore,
): { totalPercent: number; bonuses: AppliedBonus[] } {
  const buildings = store.getMutableTown().buildings
  const commercialCount = buildings.filter(
    (building) => building.buildingTypeCode === 'commercial',
  ).length
  const factoryCount = buildings.filter(
    (building) => building.buildingTypeCode === 'factory',
  ).length
  const commercialAmount =
    Math.min(commercialCount, COMMERCIAL_MAX_COUNT) *
    COMMERCIAL_BONUS_PERCENT
  const factoryAmount = Math.min(
    Math.min(factoryCount, FACTORY_MAX_COUNT) * FACTORY_BONUS_PERCENT,
    COMBINED_BONUS_CAP_PERCENT - commercialAmount,
  )
  const bonuses: AppliedBonus[] = []

  if (commercialCount > 0) {
    bonuses.push({
      sourceBuildingType: 'commercial',
      sourceCount: commercialCount,
      effectType: 'step_coin_bonus_percent',
      amount: commercialAmount,
    })
  }
  if (factoryCount > 0 && factoryAmount > 0) {
    bonuses.push({
      sourceBuildingType: 'factory',
      sourceCount: factoryCount,
      effectType: 'step_coin_bonus_percent',
      amount: factoryAmount,
    })
  }

  return {
    totalPercent: commercialAmount + factoryAmount,
    bonuses,
  }
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
      const baseCoins = Math.max(
        0,
        Math.floor(steps * coinsPerStep) -
          Math.floor(rewardedSteps * coinsPerStep),
      )
      const { totalPercent, bonuses } = calculateAppliedBonuses(store)
      const coinsAwarded = Math.floor(
        (baseCoins * (100 + totalPercent)) / 100,
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
        appliedBonuses: baseCoins > 0 ? bonuses : [],
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
