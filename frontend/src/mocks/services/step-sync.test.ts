import { describe, expect, it } from 'vitest'
import { createMockTownApi } from './town'
import { createMockStepSyncApi } from './step-sync'
import { createMockWalkCityStore } from './walk-city-store'

const FIXED_NOW = new Date('2026-08-27T03:00:00.000Z')
const DATE = '2026-08-27'

describe('createMockStepSyncApi', () => {
  it('updates the Town balance in the shared store', async () => {
    const store = createMockWalkCityStore({
      stepsByDate: { [DATE]: 1_500 },
    })
    const townApi = createMockTownApi({ latencyMs: 0, store })
    const stepSyncApi = createMockStepSyncApi({
      latencyMs: 0,
      now: () => FIXED_NOW,
      store,
      coinsPerStep: 0.1,
    })

    const before = await townApi.getMyTown()
    expect(before).toMatchObject({ ok: true, data: { town: { coins: 2_000 } } })

    await expect(stepSyncApi.syncSteps()).resolves.toMatchObject({
      ok: true,
      data: {
        date: DATE,
        steps: 1_500,
        newlyRewardedSteps: 1_500,
        coinsAwarded: 150,
        coinBalance: 2_150,
      },
    })

    const after = await townApi.getMyTown()
    expect(after).toMatchObject({ ok: true, data: { town: { coins: 2_150 } } })
  })

  it('does not reward the same steps twice and rewards only a later increase', async () => {
    const store = createMockWalkCityStore({ stepsByDate: { [DATE]: 1_000 } })
    const api = createMockStepSyncApi({
      latencyMs: 0,
      now: () => FIXED_NOW,
      store,
      coinsPerStep: 0.1,
    })

    await expect(api.syncSteps()).resolves.toMatchObject({
      ok: true,
      data: { newlyRewardedSteps: 1_000, coinsAwarded: 100 },
    })
    await expect(api.syncSteps()).resolves.toMatchObject({
      ok: true,
      data: {
        newlyRewardedSteps: 0,
        coinsAwarded: 0,
        coinBalance: 2_100,
      },
    })

    api.setSteps(DATE, 1_250)
    await expect(api.syncSteps()).resolves.toMatchObject({
      ok: true,
      data: {
        newlyRewardedSteps: 250,
        coinsAwarded: 25,
        coinBalance: 2_125,
      },
    })
  })

  it('carries sub-10-step remainders across synchronizations', async () => {
    const store = createMockWalkCityStore({ stepsByDate: { [DATE]: 9 } })
    const api = createMockStepSyncApi({
      latencyMs: 0,
      now: () => FIXED_NOW,
      store,
      coinsPerStep: 0.1,
    })

    await expect(api.syncSteps()).resolves.toMatchObject({
      ok: true,
      data: { steps: 9, coinsAwarded: 0 },
    })
    api.setSteps(DATE, 10)
    await expect(api.syncSteps()).resolves.toMatchObject({
      ok: true,
      data: { newlyRewardedSteps: 1, coinsAwarded: 1 },
    })
  })

  it('supports error injection without changing the balance', async () => {
    const store = createMockWalkCityStore({ stepsByDate: { [DATE]: 1_000 } })
    const townApi = createMockTownApi({ latencyMs: 0, store })
    const api = createMockStepSyncApi({
      latencyMs: 0,
      now: () => FIXED_NOW,
      store,
    })
    api.setFailure('HEALTH_PERMISSION_REQUIRED')

    await expect(api.syncSteps()).resolves.toMatchObject({
      ok: false,
      error: { code: 'HEALTH_PERMISSION_REQUIRED' },
    })
    await expect(townApi.getMyTown()).resolves.toMatchObject({
      ok: true,
      data: { town: { coins: 2_000 } },
    })
  })

  it('awards once after a failed request is retried', async () => {
    const store = createMockWalkCityStore({ stepsByDate: { [DATE]: 1_000 } })
    const townApi = createMockTownApi({ latencyMs: 0, store })
    const api = createMockStepSyncApi({
      latencyMs: 0,
      now: () => FIXED_NOW,
      store,
      coinsPerStep: 0.1,
    })
    api.setFailure('HEALTH_PROVIDER_ERROR')

    await expect(api.syncSteps()).resolves.toMatchObject({
      ok: false,
      error: { code: 'HEALTH_PROVIDER_ERROR' },
    })
    api.setFailure(null)
    await expect(api.syncSteps()).resolves.toMatchObject({
      ok: true,
      data: {
        newlyRewardedSteps: 1_000,
        coinsAwarded: 100,
        coinBalance: 2_100,
      },
    })
    await expect(api.syncSteps()).resolves.toMatchObject({
      ok: true,
      data: {
        newlyRewardedSteps: 0,
        coinsAwarded: 0,
        coinBalance: 2_100,
      },
    })
    await expect(townApi.getMyTown()).resolves.toMatchObject({
      ok: true,
      data: { town: { coins: 2_100 } },
    })
  })

  it('restores the shared Town and reward ledger on reset', async () => {
    const store = createMockWalkCityStore({ stepsByDate: { [DATE]: 1_000 } })
    const townApi = createMockTownApi({ latencyMs: 0, store })
    const api = createMockStepSyncApi({
      latencyMs: 0,
      now: () => FIXED_NOW,
      store,
    })

    await api.syncSteps()
    api.reset()

    await expect(townApi.getMyTown()).resolves.toMatchObject({
      ok: true,
      data: { town: { coins: 2_000 } },
    })
    await expect(api.syncSteps()).resolves.toMatchObject({
      ok: true,
      data: { newlyRewardedSteps: 1_000, coinBalance: 2_100 },
    })
  })
})
