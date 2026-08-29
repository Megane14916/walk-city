import { describe, expect, it } from 'vitest'
import { MOCK_RANKING_ENTRIES } from '../../../mocks/data/rankings'
import { isRankingEntry, isRankingPage } from './ranking-contract'

describe('Ranking Supabase contract validators', () => {
  it('accepts the current ranking contract', () => {
    expect(isRankingEntry(MOCK_RANKING_ENTRIES[0])).toBe(true)
    expect(
      isRankingPage({ entries: MOCK_RANKING_ENTRIES, nextCursor: null }),
    ).toBe(true)
  })

  it('accepts an opaque next cursor', () => {
    expect(
      isRankingPage({
        entries: MOCK_RANKING_ENTRIES.slice(0, 1),
        nextCursor: 'offset:20',
      }),
    ).toBe(true)
  })

  it('rejects negative populations and invalid ranks', () => {
    expect(
      isRankingEntry({
        ...MOCK_RANKING_ENTRIES[0],
        population: -1,
      }),
    ).toBe(false)
    expect(
      isRankingEntry({ ...MOCK_RANKING_ENTRIES[0], rank: 0 }),
    ).toBe(false)
  })
})
