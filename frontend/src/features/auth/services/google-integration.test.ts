import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseGoogleIntegrationApi } from './google-integration'

function createClientDouble(options?: {
  session?: unknown
  functionData?: unknown
  functionError?: unknown
}) {
  const invoke = vi.fn().mockResolvedValue({
    data: options?.functionData ?? null,
    error: options?.functionError ?? null,
  })
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: options?.session ?? null },
        error: null,
      }),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    functions: { invoke },
  } as unknown as SupabaseClient

  return { client, invoke }
}

describe('createSupabaseGoogleIntegrationApi', () => {
  it('returns the signed-out state without invoking an Edge Function', async () => {
    const { client, invoke } = createClientDouble()
    const api = createSupabaseGoogleIntegrationApi(client)

    expect(await api.getGoogleIntegrationState()).toEqual({
      ok: true,
      data: { session: null, healthConnection: null },
    })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('normalizes a valid Health authorization response', async () => {
    const response = {
      next: 'redirect',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    }
    const { client } = createClientDouble({
      functionData: { ok: true, data: response },
    })
    const api = createSupabaseGoogleIntegrationApi(client)

    expect(await api.startGoogleHealthConnection()).toEqual({
      ok: true,
      data: response,
    })
  })

  it('initializes the authenticated user with an empty request body', async () => {
    const response = {
      profileId: '10000000-0000-4000-8000-000000000001',
      townId: '20000000-0000-4000-8000-000000000001',
      created: true,
    }
    const { client, invoke } = createClientDouble({
      functionData: { ok: true, data: response },
    })
    const api = createSupabaseGoogleIntegrationApi(client)

    await expect(api.initializeUser()).resolves.toEqual({
      ok: true,
      data: response,
    })
    expect(invoke).toHaveBeenCalledWith('initialize-user', { body: {} })
  })

  it('rejects an invalid Edge Function response', async () => {
    const { client } = createClientDouble({ functionData: { token: 'secret' } })
    const api = createSupabaseGoogleIntegrationApi(client)

    expect(await api.startGoogleHealthConnection()).toMatchObject({
      ok: false,
      error: { code: 'HEALTH_PROVIDER_ERROR' },
    })
  })

  it('uses the production Edge Function names and request bodies', async () => {
    const { client, invoke } = createClientDouble({ session: { token: true } })
    invoke
      .mockResolvedValueOnce({
        data: { session: null, healthConnection: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          next: 'redirect',
          authorizationUrl: 'https://accounts.google.com/oauth',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { session: null, healthConnection: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          date: '2026-08-30',
          timezone: 'Asia/Tokyo',
          steps: 1234,
          newlyRewardedSteps: 1234,
          coinsAwarded: 123,
          coinBalance: 1123,
          appliedBonuses: [],
          syncedAt: '2026-08-30T00:00:00.000Z',
        },
        error: null,
      })
    const api = createSupabaseGoogleIntegrationApi(client)

    await api.getGoogleIntegrationState()
    await api.startGoogleHealthConnection()
    await api.disconnectGoogleHealth()
    await api.getDailySteps({ date: '2026-08-30', timezone: 'Asia/Tokyo' })

    expect(invoke.mock.calls).toEqual([
      ['get-google-integration-state', { body: {} }],
      ['begin-google-health-auth', { body: {} }],
      ['disconnect-google-health', { body: {} }],
      ['sync-health-steps', { body: {} }],
    ])
  })

  it('restores a stable error code from a non-2xx response safely', async () => {
    const response = new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: 'HEALTH_PERMISSION_REQUIRED',
          message: 'Google Healthの権限を確認してください。',
        },
      }),
      { status: 422, headers: { 'content-type': 'application/json' } },
    )
    const { client } = createClientDouble({
      functionError: { context: response, message: 'secret internal detail' },
    })
    const api = createSupabaseGoogleIntegrationApi(client)

    await expect(api.startGoogleHealthConnection()).resolves.toEqual({
      ok: false,
      error: {
        code: 'HEALTH_PERMISSION_REQUIRED',
        message: 'Google Healthの権限を確認してください。',
      },
    })
  })
})
