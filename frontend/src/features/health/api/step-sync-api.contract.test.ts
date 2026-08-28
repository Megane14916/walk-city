import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { MOCK_MY_TOWN } from '../../../mocks/data/towns'
import {
  createMockStepSyncApi,
  createMockWalkCityStore,
} from '../../../mocks/services'
import { createSupabaseStepSyncApi, isStepSyncStatus } from '../services'
import type { StepSyncStatus } from '../types'
import type { StepSyncApi } from './step-sync-api'

const FIXED_NOW = new Date('2026-08-27T03:00:00.000Z')
const CONTRACT_FIXTURE: StepSyncStatus = {
  date: '2026-08-27',
  timezone: 'Asia/Tokyo',
  steps: 6_500,
  newlyRewardedSteps: 1_500,
  coinsAwarded: 150,
  coinBalance: 850,
  appliedBonuses: [],
  syncedAt: FIXED_NOW.toISOString(),
}

function createSupabaseContractApi(): StepSyncApi {
  const invoke = vi.fn().mockResolvedValue({
    data: { ok: true, data: CONTRACT_FIXTURE },
    error: null,
  })
  const client = { functions: { invoke } } as unknown as SupabaseClient
  return createSupabaseStepSyncApi(client)
}

function createMockContractApi(): StepSyncApi {
  const store = createMockWalkCityStore({
    initialTown: {
      ...MOCK_MY_TOWN,
      town: { ...MOCK_MY_TOWN.town, coins: 700 },
    },
    stepsByDate: { '2026-08-27': 6_500 },
    rewardedStepsByDate: { '2026-08-27': 5_000 },
  })

  return createMockStepSyncApi({
    latencyMs: 0,
    now: () => FIXED_NOW,
    store,
    coinsPerStep: 0.1,
  })
}

describe.each([
  ['Supabase adapter', createSupabaseContractApi],
  ['mock adapter', createMockContractApi],
] as const)('StepSyncApi contract: %s', (_name, createApi) => {
  it('returns the shared StepSyncStatus contract', async () => {
    const result = await createApi().syncSteps()

    expect(result).toEqual({ ok: true, data: CONTRACT_FIXTURE })
    expect(result.ok && isStepSyncStatus(result.data)).toBe(true)
  })
})
