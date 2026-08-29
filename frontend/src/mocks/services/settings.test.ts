import { describe, expect, it } from 'vitest'
import { createMockGoogleIntegrationApi } from './google-integration'
import { createMockRankingApi } from './ranking'
import { createMockSettingsApi } from './settings'
import { createMockWalkCityStore } from './walk-city-store'

describe('MockSettingsApi', () => {
  it('updates both names atomically with normalized values', async () => {
    const store = createMockWalkCityStore()
    const api = createMockSettingsApi({
      latencyMs: 0,
      now: () => new Date('2026-08-30T12:34:56.000Z'),
      store,
    })

    const result = await api.updateUserSettings({
      displayName: '  新しい利用者  ',
      townName: '  新しい街  ',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        displayName: '新しい利用者',
        townName: '新しい街',
        updatedAt: '2026-08-30T12:34:56.000Z',
      },
    })
    expect(store.getMutableTown().town).toMatchObject({
      name: '新しい街',
      owner: { displayName: '新しい利用者' },
    })
  })

  it('does not update either value when one field is invalid', async () => {
    const store = createMockWalkCityStore()
    const before = {
      displayName: store.getMutableTown().town.owner.displayName,
      townName: store.getMutableTown().town.name,
    }
    const api = createMockSettingsApi({ latencyMs: 0, store })

    const result = await api.updateUserSettings({
      displayName: '変更されない利用者',
      townName: '',
    })

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(store.getMutableTown().town).toMatchObject({
      name: before.townName,
      owner: { displayName: before.displayName },
    })
  })

  it('consumes an injected failure once and succeeds on retry', async () => {
    const store = createMockWalkCityStore()
    const api = createMockSettingsApi({ latencyMs: 0, store })
    api.setFailure('INTERNAL_ERROR')

    const input = { displayName: '再試行利用者', townName: '再試行の街' }
    expect(await api.updateUserSettings(input)).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    })
    expect(await api.updateUserSettings(input)).toMatchObject({ ok: true })
  })

  it('feeds the updated current-user names into the next ranking read', async () => {
    const store = createMockWalkCityStore()
    const settingsApi = createMockSettingsApi({ latencyMs: 0, store })
    const rankingApi = createMockRankingApi({ latencyMs: 0, store })
    await settingsApi.updateUserSettings({
      displayName: 'ランキング反映名',
      townName: 'ランキング反映街',
    })

    const result = await rankingApi.getPopulationRanking({ limit: 30 })

    expect(result).toMatchObject({
      ok: true,
      data: {
        entries: expect.arrayContaining([
          expect.objectContaining({
            displayName: 'ランキング反映名',
            townName: 'ランキング反映街',
            isCurrentUser: true,
          }),
        ]),
      },
    })
  })

  it('uses the shared profile name in the next authenticated state read', async () => {
    const store = createMockWalkCityStore()
    const settingsApi = createMockSettingsApi({ latencyMs: 0, store })
    const googleApi = createMockGoogleIntegrationApi({
      initiallySignedIn: true,
      latencyMs: 0,
      store,
    })
    await settingsApi.updateUserSettings({
      displayName: '正式な公開名',
      townName: '認証連携の街',
    })

    const result = await googleApi.getGoogleIntegrationState()

    expect(result).toMatchObject({
      ok: true,
      data: { session: { user: { displayName: '正式な公開名' } } },
    })
  })
})
