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

    expect(result).toEqual({
      ok: true,
      data: { session: null, healthConnection: null },
    })
  })

  it('validates Supabase credentials before creating the client', () => {
    expect(() =>
      createApiServices({ VITE_API_MODE: 'supabase' }),
    ).toThrow('VITE_SUPABASE_URL')
  })
})
