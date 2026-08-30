import {
  FunctionsFetchError,
  FunctionsHttpError,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { StepSyncStatus } from '../types'
import {
  createSupabaseStepSyncApi,
  isStepSyncStatus,
  parseStepSyncResult,
} from './step-sync'

const VALID_STATUS: StepSyncStatus = {
  date: '2026-08-27',
  timezone: 'Asia/Tokyo',
  steps: 6_500,
  newlyRewardedSteps: 1_500,
  coinsAwarded: 150,
  coinBalance: 850,
  appliedBonuses: [],
  syncedAt: '2026-08-27T12:00:00+09:00',
}

function createClientDouble(result: unknown) {
  const invoke = vi.fn().mockResolvedValue(result)
  const client = { functions: { invoke } } as unknown as SupabaseClient
  return { client, invoke }
}

function cloneStatus(
  changes: Partial<Record<keyof StepSyncStatus, unknown>> = {},
): unknown {
  return {
    ...VALID_STATUS,
    appliedBonuses: VALID_STATUS.appliedBonuses.map((bonus) => ({ ...bonus })),
    ...changes,
  }
}

describe('StepSyncStatus validation', () => {
  it('accepts the agreed StepSyncStatus contract', () => {
    expect(isStepSyncStatus(VALID_STATUS)).toBe(true)
    expect(parseStepSyncResult({ ok: true, data: VALID_STATUS })).toEqual({
      ok: true,
      data: VALID_STATUS,
    })
  })

  it('accepts capped bonuses while preserving actual building counts', () => {
    expect(
      isStepSyncStatus(
        cloneStatus({
          appliedBonuses: [
            {
              sourceBuildingType: 'commercial',
              sourceCount: 4,
              effectType: 'step_coin_bonus_percent',
              amount: 30,
            },
            {
              sourceBuildingType: 'factory',
              sourceCount: 3,
              effectType: 'step_coin_bonus_percent',
              amount: 20,
            },
          ],
        }),
      ),
    ).toBe(true)
    expect(
      isStepSyncStatus(
        cloneStatus({
          appliedBonuses: [
            {
              sourceBuildingType: 'factory',
              sourceCount: 3,
              effectType: 'step_coin_bonus_percent',
              amount: 50,
            },
          ],
        }),
      ),
    ).toBe(true)
  })

  it.each([
    ['invalid calendar date', { date: '2026-02-30' }],
    ['unexpected timezone', { timezone: 'Australia/Sydney' }],
    ['negative steps', { steps: -1 }],
    ['fractional steps', { steps: 1.5 }],
    ['unsafe coin balance', { coinBalance: Number.MAX_SAFE_INTEGER + 1 }],
    ['rewarded steps over total steps', { newlyRewardedSteps: 7_000 }],
    ['invalid timestamp', { syncedAt: '2026-08-27' }],
    ['missing bonuses', { appliedBonuses: null }],
    [
      'legacy bonus effect',
      {
        appliedBonuses: [
          {
            sourceBuildingType: 'commercial',
            sourceCount: 1,
            effectType: 'step_coin_bonus_flat',
            amount: 10,
          },
        ],
      },
    ],
    [
      'incorrect capped amount',
      {
        appliedBonuses: [
          {
            sourceBuildingType: 'commercial',
            sourceCount: 4,
            effectType: 'step_coin_bonus_percent',
            amount: 40,
          },
        ],
      },
    ],
    [
      'reversed bonus order',
      {
        appliedBonuses: [
          {
            sourceBuildingType: 'factory',
            sourceCount: 1,
            effectType: 'step_coin_bonus_percent',
            amount: 25,
          },
          {
            sourceBuildingType: 'commercial',
            sourceCount: 1,
            effectType: 'step_coin_bonus_percent',
            amount: 10,
          },
        ],
      },
    ],
    [
      'bonus with no awarded coins',
      {
        coinsAwarded: 0,
        appliedBonuses: [
          {
            sourceBuildingType: 'commercial',
            sourceCount: 1,
            effectType: 'step_coin_bonus_percent',
            amount: 10,
          },
        ],
      },
    ],
  ])('rejects %s', (_label, changes) => {
    expect(isStepSyncStatus(cloneStatus(changes))).toBe(false)
    expect(
      parseStepSyncResult({ ok: true, data: cloneStatus(changes) }),
    ).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    })
  })

  it('rejects raw and legacy success responses', () => {
    expect(parseStepSyncResult(VALID_STATUS)).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    })
    expect(
      parseStepSyncResult({ status: 'ok', data: VALID_STATUS }),
    ).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    })
  })
})

describe('createSupabaseStepSyncApi', () => {
  it('invokes sync-health-steps with only an empty body', async () => {
    const response = { ok: true, data: VALID_STATUS }
    const { client, invoke } = createClientDouble({
      data: response,
      error: null,
    })
    const api = createSupabaseStepSyncApi(client)

    await expect(api.syncSteps()).resolves.toEqual(response)
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith('sync-health-steps', { body: {} })
  })

  it('supports an injected function name for isolated environments', async () => {
    const { client, invoke } = createClientDouble({
      data: { ok: true, data: VALID_STATUS },
      error: null,
    })
    const api = createSupabaseStepSyncApi(client, {
      functionName: 'test-sync-health-steps',
    })

    await api.syncSteps()

    expect(invoke).toHaveBeenCalledWith('test-sync-health-steps', { body: {} })
  })

  it('normalizes a known error envelope from a non-2xx response', async () => {
    const response = new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: 'HEALTH_PERMISSION_REQUIRED',
          message: '歩数を読み取る権限が必要です。',
        },
      }),
      {
        status: 422,
        headers: { 'content-type': 'application/json' },
      },
    )
    const { client } = createClientDouble({
      data: null,
      error: new FunctionsHttpError(response),
    })
    const api = createSupabaseStepSyncApi(client)

    await expect(api.syncSteps()).resolves.toEqual({
      ok: false,
      error: {
        code: 'HEALTH_PERMISSION_REQUIRED',
        message: '歩数を読み取る権限が必要です。',
      },
    })
  })

  it('maps an unstructured 401 response to UNAUTHENTICATED', async () => {
    const response = new Response('unauthorized', { status: 401 })
    const { client } = createClientDouble({
      data: null,
      error: new FunctionsHttpError(response),
    })
    const api = createSupabaseStepSyncApi(client)

    await expect(api.syncSteps()).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    })
  })

  it('rejects unknown error codes and oversized server messages', () => {
    expect(
      parseStepSyncResult({
        ok: false,
        error: { code: 'SECRET_BACKEND_ERROR', message: 'do not expose' },
      }),
    ).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } })

    expect(
      parseStepSyncResult({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'x'.repeat(501) },
      }),
    ).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } })
  })

  it('maps fetch failures and thrown invocations without exposing details', async () => {
    const fetchFailure = createClientDouble({
      data: null,
      error: new FunctionsFetchError(new Error('secret transport detail')),
    })
    const fetchApi = createSupabaseStepSyncApi(fetchFailure.client)

    await expect(fetchApi.syncSteps()).resolves.toEqual({
      ok: false,
      error: {
        code: 'HEALTH_PROVIDER_ERROR',
        message: 'Google Healthとの通信に失敗しました。',
      },
    })

    const invoke = vi.fn().mockRejectedValue(new Error('secret rejection'))
    const client = { functions: { invoke } } as unknown as SupabaseClient
    const thrownApi = createSupabaseStepSyncApi(client)

    await expect(thrownApi.syncSteps()).resolves.toMatchObject({
      ok: false,
      error: { code: 'HEALTH_PROVIDER_ERROR' },
    })
  })
})
