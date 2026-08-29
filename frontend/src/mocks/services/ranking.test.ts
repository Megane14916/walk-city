import { describe, expect, it } from 'vitest'
import type { RankingApi } from '../../features/ranking/api'
import type { RankingEntry } from '../../features/ranking/types'
import { MOCK_RANKING_ENTRIES } from '../data/rankings'
import {
  createMockRankingApi,
  DEFAULT_RANKING_PAGE_SIZE,
} from './ranking'
import { createMockTownApi } from './town'
import { createMockWalkCityStore } from './walk-city-store'

function expectFailureCode(
  result: Awaited<ReturnType<RankingApi['getPopulationRanking']>>,
  code: string,
) {
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error.code).toBe(code)
}

function describeRankingApiContract(
  name: string,
  createApi: () => RankingApi,
) {
  describe(`${name} RankingApi contract`, () => {
    it('returns the first page with the default limit', async () => {
      const result = await createApi().getPopulationRanking({})

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.entries).toHaveLength(DEFAULT_RANKING_PAGE_SIZE)
      expect(result.data.entries[0]).toEqual(MOCK_RANKING_ENTRIES[0])
      expect(result.data.nextCursor).toEqual(expect.any(String))
    })

    it('uses the returned opaque cursor to fetch the remaining entries', async () => {
      const api = createApi()
      const first = await api.getPopulationRanking({})
      expect(first.ok).toBe(true)
      if (!first.ok || first.data.nextCursor === null) return

      const second = await api.getPopulationRanking({
        cursor: first.data.nextCursor,
      })

      expect(second.ok).toBe(true)
      if (!second.ok) return
      expect(second.data.entries).toEqual(MOCK_RANKING_ENTRIES.slice(20))
      expect(second.data.nextCursor).toBeNull()
    })

    it.each([0, -1, 1.5])('rejects invalid limit %s', async (limit) => {
      const result = await createApi().getPopulationRanking({ limit })
      expectFailureCode(result, 'INVALID_INPUT')
    })

    it.each(['', 'invalid-cursor', 'mock-ranking-cursor-v1:999'])(
      'rejects invalid cursor %s',
      async (cursor) => {
        const result = await createApi().getPopulationRanking({ cursor })
        expectFailureCode(result, 'INVALID_INPUT')
      },
    )

    it('returns copies that cannot mutate later responses', async () => {
      const api = createApi()
      const first = await api.getPopulationRanking({ limit: 1 })
      expect(first.ok).toBe(true)
      if (!first.ok) return

      first.data.entries[0].displayName = '変更済み'
      const again = await api.getPopulationRanking({ limit: 1 })

      expect(again.ok).toBe(true)
      if (!again.ok) return
      expect(again.data.entries[0].displayName).toBe(
        MOCK_RANKING_ENTRIES[0].displayName,
      )
    })
  })
}

describeRankingApiContract('Mock', () =>
  createMockRankingApi({ latencyMs: 0 }),
)

describe('MockRankingApi scenarios', () => {
  it('reflects the latest town population and recalculates the current user rank', async () => {
    const store = createMockWalkCityStore()
    const townApi = createMockTownApi({ latencyMs: 0, store })
    const rankingApi = createMockRankingApi({ latencyMs: 0, store })

    const before = await rankingApi.getPopulationRanking({})
    expect(before.ok).toBe(true)
    if (!before.ok) return
    expect(before.data.entries.find((entry) => entry.isCurrentUser)).toMatchObject({
      population: 60,
      rank: 17,
    })

    await expect(
      townApi.placeBuilding({
        buildingTypeCode: 'apartment',
        anchorX: 40,
        anchorY: 49,
        requestId: 'ranking-population-sync',
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: { population: 110 },
    })

    const after = await rankingApi.getPopulationRanking({})
    expect(after.ok).toBe(true)
    if (!after.ok) return
    expect(after.data.entries.find((entry) => entry.isCurrentUser)).toMatchObject({
      population: 110,
      rank: 13,
    })
  })

  it('supports an empty ranking', async () => {
    const api = createMockRankingApi({ latencyMs: 0, entries: [] })
    const result = await api.getPopulationRanking({})

    expect(result).toEqual({
      ok: true,
      data: { entries: [], nextCursor: null },
    })
  })

  it('contains ties, the current user, long names, and a zero population', () => {
    expect(MOCK_RANKING_ENTRIES).toHaveLength(25)
    expect(
      MOCK_RANKING_ENTRIES.some(
        (entry, index) =>
          index > 0 &&
          entry.rank === MOCK_RANKING_ENTRIES[index - 1].rank &&
          entry.population === MOCK_RANKING_ENTRIES[index - 1].population,
      ),
    ).toBe(true)
    expect(
      MOCK_RANKING_ENTRIES.filter((entry) => entry.isCurrentUser),
    ).toHaveLength(1)
    expect(
      MOCK_RANKING_ENTRIES.some(
        (entry) => entry.displayName.length > 20 && entry.townName.length > 20,
      ),
    ).toBe(true)
    expect(MOCK_RANKING_ENTRIES.at(-1)?.population).toBe(0)
  })

  it('fails the initial request once and then succeeds', async () => {
    const api = createMockRankingApi({ latencyMs: 0 })
    api.setFailure('initial', 'INTERNAL_ERROR', { once: true })

    expectFailureCode(await api.getPopulationRanking({}), 'INTERNAL_ERROR')
    expect((await api.getPopulationRanking({})).ok).toBe(true)
  })

  it('fails load more once without affecting the initial page', async () => {
    const api = createMockRankingApi({ latencyMs: 0 })
    const first = await api.getPopulationRanking({})
    expect(first.ok).toBe(true)
    if (!first.ok || first.data.nextCursor === null) return

    api.setFailure('loadMore', 'INTERNAL_ERROR', { once: true })
    expectFailureCode(
      await api.getPopulationRanking({ cursor: first.data.nextCursor }),
      'INTERNAL_ERROR',
    )
    expect(
      (await api.getPopulationRanking({ cursor: first.data.nextCursor })).ok,
    ).toBe(true)
  })

  it('clears configured failures on reset', async () => {
    const api = createMockRankingApi({ latencyMs: 0 })
    api.setFailure('initial', 'UNAUTHENTICATED')
    api.reset()

    expect((await api.getPopulationRanking({})).ok).toBe(true)
  })

  it('does not sort the entries supplied by the API fixture', async () => {
    const customEntries: RankingEntry[] = [
      { ...MOCK_RANKING_ENTRIES[1] },
      { ...MOCK_RANKING_ENTRIES[0] },
    ]
    const api = createMockRankingApi({ latencyMs: 0, entries: customEntries })
    const result = await api.getPopulationRanking({})

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.entries.map((entry) => entry.userId)).toEqual(
      customEntries.map((entry) => entry.userId),
    )
  })
})
