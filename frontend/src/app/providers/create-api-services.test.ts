import { describe, expect, it } from 'vitest'
import { createApiServices, resolveApiMode } from './create-api-services'

describe('resolveApiMode', () => {
  it('uses mock mode when the environment variable is omitted', () => {
    expect(resolveApiMode(undefined)).toBe('mock')
  })

  it('requires an explicit Supabase mode in production', () => {
    expect(() => resolveApiMode(undefined, true)).toThrow(
      '本番環境ではVITE_API_MODE=supabaseの設定が必要です。',
    )
    expect(() => resolveApiMode('mock', true)).toThrow(
      '本番環境ではVITE_API_MODE=supabase以外を使用できません。',
    )
    expect(resolveApiMode('supabase', true)).toBe('supabase')
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
    const rankingResult = await services.rankingApi.getPopulationRanking({})

    expect(result).toEqual({
      ok: true,
      data: { session: null, healthConnection: null },
    })
    expect(townResult).toMatchObject({
      ok: true,
      data: { town: { coins: 2_000 } },
    })
    expect(rankingResult).toMatchObject({
      ok: true,
      data: {
        entries: expect.arrayContaining([
          expect.objectContaining({ isCurrentUser: true, population: 60 }),
        ]),
      },
    })
    expect(typeof services.stepSyncApi.syncSteps).toBe('function')
  })

  it('validates Supabase credentials before creating the client', () => {
    expect(() =>
      createApiServices({ VITE_API_MODE: 'supabase' }),
    ).toThrow('VITE_SUPABASE_URL')
  })

  it('fails closed before creating production mock services', () => {
    expect(() => createApiServices({ PROD: true })).toThrow(
      'VITE_API_MODE=supabase',
    )
    expect(() =>
      createApiServices({ PROD: true, VITE_API_MODE: 'mock' }),
    ).toThrow('VITE_API_MODE=supabase以外を使用できません。')
  })

  it('creates every lazy Supabase service without mixing mock data', async () => {
    const services = createApiServices({
      VITE_API_MODE: 'supabase',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-test-key',
    })

    expect(typeof services.townApi.getBuildingCatalog).toBe('function')
    expect(typeof services.townApi.getMyTown).toBe('function')
    expect(typeof services.townApi.getPublicTown).toBe('function')
    expect(typeof services.townApi.placeBuilding).toBe('function')
    expect(typeof services.townApi.placeRoadLine).toBe('function')
    expect(typeof services.townApi.moveBuilding).toBe('function')
    expect(typeof services.townApi.unlockLand).toBe('function')
    expect(services.townApi.supportsBuildingRename).toBe(true)
    expect(typeof services.rankingApi.getPopulationRanking).toBe('function')
    expect(typeof services.stepSyncApi.syncSteps).toBe('function')
    expect(
      typeof services.googleIntegrationApi.getGoogleIntegrationState,
    ).toBe('function')
    expect(
      typeof services.googleIntegrationApi.startGoogleHealthConnection,
    ).toBe('function')
  })
})
