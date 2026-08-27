import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseGoogleIntegrationApi } from './google-integration'

function createClientDouble(options?: {
  session?: unknown
  functionData?: unknown
}) {
  const invoke = vi.fn().mockResolvedValue({
    data: options?.functionData ?? null,
    error: null,
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

  it('rejects an invalid Edge Function response', async () => {
    const { client } = createClientDouble({ functionData: { token: 'secret' } })
    const api = createSupabaseGoogleIntegrationApi(client)

    expect(await api.startGoogleHealthConnection()).toMatchObject({
      ok: false,
      error: { code: 'HEALTH_PROVIDER_ERROR' },
    })
  })
})
