import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseRankingApi } from './ranking'

const CURRENT_USER_ID = '10000000-0000-4000-8000-000000000001'
const OTHER_USER_ID = '20000000-0000-4000-8000-000000000001'

const ROWS = [
  {
    rank: '1',
    user_id: OTHER_USER_ID,
    display_name: 'あおい',
    town_id: '30000000-0000-4000-8000-000000000001',
    town_name: 'あおいタウン',
    population: '120',
  },
  {
    rank: 2,
    user_id: CURRENT_USER_ID,
    display_name: 'めぐ',
    town_id: '40000000-0000-4000-8000-000000000001',
    town_name: 'ウォークシティ',
    population: 100,
  },
]

function createSupabaseMock(data: unknown, error: unknown = null) {
  const orders: Array<{ column: string; options: unknown }> = []
  const ranges: Array<[number, number]> = []
  const range = vi.fn((from: number, to: number) => {
    ranges.push([from, to])
    return Promise.resolve({ data, error })
  })
  const builder = {
    order: vi.fn((column: string, options: unknown) => {
      orders.push({ column, options })
      return builder
    }),
    range,
  }
  const select = vi.fn(() => builder)
  const from = vi.fn(() => ({ select }))
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { id: CURRENT_USER_ID } },
    error: null,
  })

  return {
    client: { from, auth: { getUser } } as unknown as SupabaseClient,
    from,
    select,
    orders,
    ranges,
    getUser,
  }
}

describe('createSupabaseRankingApi', () => {
  it('maps the production ranking view and marks the signed-in user', async () => {
    const mock = createSupabaseMock(ROWS)
    const api = createSupabaseRankingApi(mock.client)

    await expect(api.getPopulationRanking({ limit: 20 })).resolves.toEqual({
      ok: true,
      data: {
        entries: [
          {
            rank: 1,
            userId: OTHER_USER_ID,
            displayName: 'あおい',
            townId: '30000000-0000-4000-8000-000000000001',
            townName: 'あおいタウン',
            population: 120,
            isCurrentUser: false,
          },
          {
            rank: 2,
            userId: CURRENT_USER_ID,
            displayName: 'めぐ',
            townId: '40000000-0000-4000-8000-000000000001',
            townName: 'ウォークシティ',
            population: 100,
            isCurrentUser: true,
          },
        ],
        nextCursor: null,
      },
    })

    expect(mock.from).toHaveBeenCalledWith('population_ranking_view')
    expect(mock.select).toHaveBeenCalledWith(
      'rank,user_id,display_name,town_id,town_name,population',
    )
    expect(mock.orders).toEqual([
      { column: 'population', options: { ascending: false } },
      { column: 'display_name', options: { ascending: true } },
      { column: 'user_id', options: { ascending: true } },
    ])
    expect(mock.ranges).toEqual([[0, 20]])
  })

  it('uses a service-owned cursor and requests one extra row', async () => {
    const mock = createSupabaseMock([...ROWS, ROWS[0]])
    const api = createSupabaseRankingApi(mock.client)

    const result = await api.getPopulationRanking({
      limit: 2,
      cursor: 'offset:20',
    })

    expect(result).toMatchObject({
      ok: true,
      data: { entries: expect.any(Array), nextCursor: 'offset:22' },
    })
    expect(mock.ranges).toEqual([[20, 22]])
    if (result.ok) expect(result.data.entries).toHaveLength(2)
  })

  it('rejects invalid limits and cursors before querying Supabase', async () => {
    const mock = createSupabaseMock([])
    const api = createSupabaseRankingApi(mock.client)

    await expect(api.getPopulationRanking({ limit: 101 })).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    await expect(
      api.getPopulationRanking({ cursor: 'page:2' }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(mock.getUser).not.toHaveBeenCalled()
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('fails closed for unauthenticated and malformed responses', async () => {
    const unauthenticated = createSupabaseMock([])
    unauthenticated.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 401 },
    })
    const unauthenticatedApi = createSupabaseRankingApi(
      unauthenticated.client,
    )
    await expect(
      unauthenticatedApi.getPopulationRanking({}),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    })

    const malformed = createSupabaseMock([{ ...ROWS[0], population: -1 }])
    const malformedApi = createSupabaseRankingApi(malformed.client)
    await expect(
      malformedApi.getPopulationRanking({}),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'ランキングを取得できませんでした。',
      },
    })
  })
})
