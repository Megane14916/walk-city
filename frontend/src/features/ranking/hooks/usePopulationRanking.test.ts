// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RankingApi } from '../api'
import type { RankingEntry, RankingPage } from '../types'
import type { ApiResult } from '../../../types/common'
import { MOCK_RANKING_ENTRIES } from '../../../mocks/data/rankings'
import { createMockRankingApi } from '../../../mocks/services/ranking'
import {
  mergeRankingEntries,
  usePopulationRanking,
} from './usePopulationRanking'

function success(data: RankingPage): ApiResult<RankingPage> {
  return { ok: true, data }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('mergeRankingEntries', () => {
  it('replaces duplicates in place and appends new users in API order', () => {
    const original = MOCK_RANKING_ENTRIES.slice(0, 2)
    const replacement = {
      ...original[0],
      population: original[0].population + 10,
    }
    const incoming = [replacement, MOCK_RANKING_ENTRIES[2]]

    expect(mergeRankingEntries(original, incoming)).toEqual([
      replacement,
      original[1],
      incoming[1],
    ])
  })
})

describe('usePopulationRanking', () => {
  it('loads the initial page and exposes the next-page state', async () => {
    const api = createMockRankingApi({ latencyMs: 0 })
    const { result } = renderHook(() => usePopulationRanking(api))

    expect(result.current.isInitialLoading).toBe(true)
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false))

    expect(result.current.entries).toHaveLength(20)
    expect(result.current.hasNextPage).toBe(true)
    expect(result.current.initialError).toBeNull()
  })

  it('supports an empty ranking', async () => {
    const api = createMockRankingApi({ latencyMs: 0, entries: [] })
    const { result } = renderHook(() => usePopulationRanking(api))

    await waitFor(() => expect(result.current.isInitialLoading).toBe(false))
    expect(result.current.entries).toEqual([])
    expect(result.current.hasNextPage).toBe(false)
  })

  it('retries an initial failure', async () => {
    const api = createMockRankingApi({ latencyMs: 0 })
    api.setFailure('initial', 'INTERNAL_ERROR', { once: true })
    const { result } = renderHook(() => usePopulationRanking(api))

    await waitFor(() =>
      expect(result.current.initialError?.code).toBe('INTERNAL_ERROR'),
    )
    await act(() => result.current.retryInitial())

    expect(result.current.initialError).toBeNull()
    expect(result.current.entries).toHaveLength(20)
  })

  it('loads more once and ignores repeated calls while pending', async () => {
    const api = createMockRankingApi({ latencyMs: 10 })
    const getPopulationRanking = vi.spyOn(api, 'getPopulationRanking')
    const { result } = renderHook(() => usePopulationRanking(api))

    await waitFor(() => expect(result.current.entries).toHaveLength(20))

    let firstPromise!: Promise<void>
    let secondPromise!: Promise<void>
    act(() => {
      firstPromise = result.current.loadMore()
      secondPromise = result.current.loadMore()
    })
    await act(() => Promise.all([firstPromise, secondPromise]))

    expect(getPopulationRanking).toHaveBeenCalledTimes(2)
    expect(result.current.entries).toHaveLength(25)
    expect(result.current.hasNextPage).toBe(false)
  })

  it('keeps entries and retries the same cursor after load-more failure', async () => {
    const api = createMockRankingApi({ latencyMs: 0 })
    const { result } = renderHook(() => usePopulationRanking(api))
    await waitFor(() => expect(result.current.entries).toHaveLength(20))

    api.setFailure('loadMore', 'INTERNAL_ERROR', { once: true })
    await act(() => result.current.loadMore())

    expect(result.current.entries).toHaveLength(20)
    expect(result.current.loadMoreError?.code).toBe('INTERNAL_ERROR')

    await act(() => result.current.retryLoadMore())
    expect(result.current.entries).toHaveLength(25)
    expect(result.current.loadMoreError).toBeNull()
  })

  it('keeps existing entries when refresh fails', async () => {
    const api = createMockRankingApi({ latencyMs: 0 })
    const { result } = renderHook(() => usePopulationRanking(api))
    await waitFor(() => expect(result.current.entries).toHaveLength(20))

    api.setFailure('initial', 'INTERNAL_ERROR', { once: true })
    await act(() => result.current.refresh())

    expect(result.current.entries).toHaveLength(20)
    expect(result.current.refreshError?.code).toBe('INTERNAL_ERROR')
  })

  it('discards an old load-more response after refresh succeeds', async () => {
    const oldLoadMore = deferred<ApiResult<RankingPage>>()
    const refreshedEntry: RankingEntry = {
      ...MOCK_RANKING_ENTRIES[0],
      population: 999,
    }
    const getPopulationRanking = vi
      .fn<RankingApi['getPopulationRanking']>()
      .mockResolvedValueOnce(
        success({
          entries: MOCK_RANKING_ENTRIES.slice(0, 20),
          nextCursor: 'next-page',
        }),
      )
      .mockImplementationOnce(() => oldLoadMore.promise)
      .mockResolvedValueOnce(
        success({ entries: [refreshedEntry], nextCursor: null }),
      )
    const api: RankingApi = { getPopulationRanking }
    const { result } = renderHook(() => usePopulationRanking(api))
    await waitFor(() => expect(result.current.entries).toHaveLength(20))

    let loadMorePromise!: Promise<void>
    act(() => {
      loadMorePromise = result.current.loadMore()
    })
    await waitFor(() => expect(result.current.isLoadingMore).toBe(true))
    await act(() => result.current.refresh())

    oldLoadMore.resolve(
      success({
        entries: MOCK_RANKING_ENTRIES.slice(20),
        nextCursor: null,
      }),
    )
    await act(() => loadMorePromise)

    expect(result.current.entries).toEqual([refreshedEntry])
    expect(result.current.hasNextPage).toBe(false)
  })

  it('normalizes a thrown API error and does not update after unmount', async () => {
    const request = deferred<ApiResult<RankingPage>>()
    const api: RankingApi = {
      getPopulationRanking: vi
        .fn<RankingApi['getPopulationRanking']>()
        .mockRejectedValueOnce(new Error('network details'))
        .mockImplementationOnce(() => request.promise),
    }
    const first = renderHook(() => usePopulationRanking(api))

    await waitFor(() =>
      expect(first.result.current.initialError).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'ランキングの取得に失敗しました。',
      }),
    )

    const second = renderHook(() => usePopulationRanking(api))
    second.unmount()
    request.resolve(
      success({ entries: MOCK_RANKING_ENTRIES.slice(0, 1), nextCursor: null }),
    )
    await request.promise

    expect(api.getPopulationRanking).toHaveBeenCalledTimes(2)
  })
})
