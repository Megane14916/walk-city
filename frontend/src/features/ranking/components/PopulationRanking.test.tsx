// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { MOCK_RANKING_ENTRIES } from '../../../mocks/data/rankings'
import { createMockRankingApi } from '../../../mocks/services/ranking'
import { PopulationRanking } from './PopulationRanking'
import { RankingItem } from './RankingItem'
import { RankingList } from './RankingList'

const getUserHref = (userId: string) => `/users/${encodeURIComponent(userId)}`

afterEach(cleanup)

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('RankingItem', () => {
  it('shows the API values and identifies the current user in text', () => {
    const currentUser = MOCK_RANKING_ENTRIES.find(
      (entry) => entry.isCurrentUser,
    )
    if (!currentUser) throw new Error('current-user fixture is required')

    renderWithRouter(
      <ol>
        <RankingItem
          entry={currentUser}
          href={getUserHref(currentUser.userId)}
        />
      </ol>,
    )

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe(`/users/${currentUser.userId}`)
    expect(link.getAttribute('aria-current')).toBe('true')
    expect(link.getAttribute('aria-label')).toBe(
      `${currentUser.rank}位、${currentUser.displayName}、${currentUser.townName}、人口60人、あなた`,
    )
    expect(screen.getByText('あなた')).not.toBeNull()
  })

  it('preserves long names in title attributes', () => {
    const longEntry = MOCK_RANKING_ENTRIES.find(
      (entry) => entry.displayName.length > 20,
    )
    if (!longEntry) throw new Error('long-name fixture is required')

    renderWithRouter(
      <ol>
        <RankingItem entry={longEntry} href={getUserHref(longEntry.userId)} />
      </ol>,
    )

    expect(screen.getByTitle(longEntry.displayName)).not.toBeNull()
    expect(screen.getByTitle(longEntry.townName)).not.toBeNull()
  })
})

describe('RankingList', () => {
  it('keeps API order and displays tied ranks unchanged', () => {
    const tiedEntries = MOCK_RANKING_ENTRIES.slice(3, 5)
    renderWithRouter(
      <RankingList entries={tiedEntries} getUserHref={getUserHref} />,
    )

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText(tiedEntries[0].displayName)).not.toBeNull()
    expect(within(items[1]).getByText(tiedEntries[1].displayName)).not.toBeNull()
    expect(within(items[0]).getByText(String(tiedEntries[0].rank))).not.toBeNull()
    expect(within(items[1]).getByText(String(tiedEntries[1].rank))).not.toBeNull()
  })
})

describe('PopulationRanking', () => {
  it('shows a loading state and then the first page', async () => {
    const api = createMockRankingApi({ latencyMs: 10 })
    renderWithRouter(<PopulationRanking api={api} getUserHref={getUserHref} />)

    expect(
      screen.getByRole('status', { name: '人口ランキングを読み込み中' }),
    ).not.toBeNull()
    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(20),
    )
    expect(
      (screen.getByRole('button', { name: 'さらに見る' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })

  it('loads the remaining entries and announces completion', async () => {
    const api = createMockRankingApi({ latencyMs: 0 })
    renderWithRouter(<PopulationRanking api={api} getUserHref={getUserHref} />)
    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(20),
    )

    fireEvent.click(screen.getByRole('button', { name: 'さらに見る' }))

    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(25),
    )
    expect(
      screen.getByText('すべてのランキングを表示しました'),
    ).not.toBeNull()
  })

  it('shows the empty state without load-more controls', async () => {
    const api = createMockRankingApi({ latencyMs: 0, entries: [] })
    renderWithRouter(<PopulationRanking api={api} getUserHref={getUserHref} />)

    expect(
      await screen.findByRole('heading', {
        name: 'まだランキング参加者がいません',
      }),
    ).not.toBeNull()
    expect(
      screen.queryByRole('button', { name: 'さらに見る' }),
    ).toBeNull()
  })

  it('retries an initial error', async () => {
    const api = createMockRankingApi({ latencyMs: 0 })
    api.setFailure('initial', 'INTERNAL_ERROR', { once: true })
    renderWithRouter(<PopulationRanking api={api} getUserHref={getUserHref} />)

    expect(
      await screen.findByRole('heading', {
        name: 'ランキングを読み込めませんでした',
      }),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'もう一度試す' }))

    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(20),
    )
  })

  it('keeps the first page visible when load more fails and can retry', async () => {
    const api = createMockRankingApi({ latencyMs: 0 })
    renderWithRouter(<PopulationRanking api={api} getUserHref={getUserHref} />)
    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(20),
    )

    api.setFailure('loadMore', 'INTERNAL_ERROR', { once: true })
    fireEvent.click(screen.getByRole('button', { name: 'さらに見る' }))

    expect(
      await screen.findByRole('button', { name: '追加取得を再試行' }),
    ).not.toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(20)

    fireEvent.click(screen.getByRole('button', { name: '追加取得を再試行' }))
    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(25),
    )
  })

  it('keeps the ranking visible when refresh fails', async () => {
    const api = createMockRankingApi({ latencyMs: 0 })
    renderWithRouter(<PopulationRanking api={api} getUserHref={getUserHref} />)
    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(20),
    )

    api.setFailure('initial', 'INTERNAL_ERROR', { once: true })
    fireEvent.click(screen.getByRole('button', { name: '更新' }))

    expect(
      await screen.findByText('ランキングを更新できませんでした'),
    ).not.toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(20)
  })
})
