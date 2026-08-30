import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  createMockSettingsApi,
  createMockWalkCityStore,
} from '../../../mocks/services'
import { createSupabaseSettingsApi } from '../services'
import type { SettingsApi } from './settings-api'

const UPDATED_AT = '2026-08-30T12:34:56.000Z'

function createSupabaseContractApi(): SettingsApi {
  const rpc = vi.fn().mockResolvedValue({
    data: {
      ok: true,
      data: {
        display_name: '共通ユーザー',
        town_name: '共通の街',
        updated_at: UPDATED_AT,
      },
    },
    error: null,
  })
  return createSupabaseSettingsApi({ rpc } as unknown as SupabaseClient)
}

function createMockContractApi(): SettingsApi {
  return createMockSettingsApi({
    latencyMs: 0,
    now: () => new Date(UPDATED_AT),
    store: createMockWalkCityStore(),
  })
}

describe.each([
  ['Supabase adapter', createSupabaseContractApi],
  ['mock adapter', createMockContractApi],
] as const)('SettingsApi contract: %s', (_name, createApi) => {
  it('updates both names and returns the shared UserSettings shape', async () => {
    await expect(
      createApi().updateUserSettings({
        displayName: '  共通ユーザー  ',
        townName: '  共通の街  ',
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        displayName: '共通ユーザー',
        townName: '共通の街',
        updatedAt: UPDATED_AT,
      },
    })
  })
})

