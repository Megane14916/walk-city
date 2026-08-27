import { describe, expect, it } from 'vitest'
import { createApiServices, resolveApiMode } from './create-api-services'

describe('resolveApiMode', () => {
  it('uses mock mode when the environment variable is omitted', () => {
    expect(resolveApiMode(undefined)).toBe('mock')
  })

  it('rejects unsupported API modes', () => {
    expect(() => resolveApiMode('preview')).toThrow(
      'VITE_API_MODEはmockまたはsupabaseを指定してください。',
    )
  })
})

describe('createApiServices', () => {
  it('creates the mock implementation without Supabase credentials', async () => {
    const services = createApiServices({ VITE_API_MODE: 'mock' })
    const result =
      await services.googleIntegrationApi.getGoogleIntegrationState()
    const townResult = await services.townApi.getMyTown()

    expect(result).toEqual({
      ok: true,
      data: { session: null, healthConnection: null },
    })
    expect(townResult).toMatchObject({
      ok: true,
      data: { town: { coins: 500 } },
    })
    expect(typeof services.stepSyncApi.syncSteps).toBe('function')
  })

  it('validates Supabase credentials before creating the client', () => {
    expect(() =>
      createApiServices({ VITE_API_MODE: 'supabase' }),
    ).toThrow('VITE_SUPABASE_URL')
  })

  it('does not mix a mock Town into Supabase mode', async () => {
    const services = createApiServices({
      VITE_API_MODE: 'supabase',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-test-key',
    })

    await expect(services.townApi.getMyTown()).resolves.toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '街データAPIは現在準備中です。',
      },
    })
  })
})
