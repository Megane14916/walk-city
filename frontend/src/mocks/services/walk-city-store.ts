import type { TownDetail } from '../../features/town/types'
import { MOCK_DAILY_STEPS_BY_DATE } from '../data/health'
import { MOCK_MY_TOWN } from '../data/towns'

export type MockWalkCityStoreOptions = {
  initialTown?: TownDetail
  stepsByDate?: Record<string, number>
  rewardedStepsByDate?: Record<string, number>
}

export type MockWalkCityStore = {
  getMutableTown(): TownDetail
  getSteps(date: string): number
  setSteps(date: string, steps: number): void
  getRewardedSteps(date: string): number
  setRewardedSteps(date: string, steps: number): void
  awardCoins(amount: number): number | null
  reset(): void
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function copyTown(town: TownDetail): TownDetail {
  return {
    town: {
      ...town.town,
      owner: { ...town.town.owner },
    },
    buildings: town.buildings.map((building) => ({ ...building })),
    unlockedAreas: town.unlockedAreas.map((area) => ({ ...area })),
    obstacles: town.obstacles.map((obstacle) => ({ ...obstacle })),
    catalogVersion: town.catalogVersion,
    editable: town.editable,
  }
}

function assertDailySteps(date: string, steps: number): void {
  if (!DATE_PATTERN.test(date) || !Number.isSafeInteger(steps) || steps < 0) {
    throw new Error('dateはYYYY-MM-DD、stepsは0以上の整数にしてください。')
  }
}

export function createMockWalkCityStore(
  options: MockWalkCityStoreOptions = {},
): MockWalkCityStore {
  const initialTown = copyTown(options.initialTown ?? MOCK_MY_TOWN)
  const initialSteps = {
    ...MOCK_DAILY_STEPS_BY_DATE,
    ...options.stepsByDate,
  }
  const initialRewardedSteps = { ...options.rewardedStepsByDate }

  let town = copyTown(initialTown)
  let stepsByDate = { ...initialSteps }
  let rewardedStepsByDate = { ...initialRewardedSteps }

  return {
    getMutableTown() {
      return town
    },

    getSteps(date) {
      return stepsByDate[date] ?? 0
    },

    setSteps(date, steps) {
      assertDailySteps(date, steps)
      stepsByDate[date] = steps
    },

    getRewardedSteps(date) {
      return rewardedStepsByDate[date] ?? 0
    },

    setRewardedSteps(date, steps) {
      assertDailySteps(date, steps)
      rewardedStepsByDate[date] = steps
    },

    awardCoins(amount) {
      if (!Number.isSafeInteger(amount) || amount < 0) {
        throw new Error('付与コインは0以上の整数にしてください。')
      }

      const balance = town.town.coins
      if (balance === undefined) return null

      const nextBalance = balance + amount
      if (!Number.isSafeInteger(nextBalance)) {
        throw new Error('コイン残高が安全な整数範囲を超えています。')
      }

      town.town.coins = nextBalance
      return nextBalance
    },

    reset() {
      town = copyTown(initialTown)
      stepsByDate = { ...initialSteps }
      rewardedStepsByDate = { ...initialRewardedSteps }
    },
  }
}

export const mockWalkCityStore = createMockWalkCityStore()
