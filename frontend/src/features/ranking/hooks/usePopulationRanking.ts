import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError } from '../../../types/common'
import type { RankingApi } from '../api'
import type { RankingEntry } from '../types'

export const RANKING_PAGE_SIZE = 20

export type PopulationRankingState = {
  entries: RankingEntry[]
  isInitialLoading: boolean
  isRefreshing: boolean
  isLoadingMore: boolean
  initialError: ApiError | null
  refreshError: ApiError | null
  loadMoreError: ApiError | null
  hasNextPage: boolean
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  retryInitial: () => Promise<void>
  retryLoadMore: () => Promise<void>
}

type RankingDataState = Omit<
  PopulationRankingState,
  'refresh' | 'loadMore' | 'retryInitial' | 'retryLoadMore'
> & {
  nextCursor: string | null
}

const UNEXPECTED_ERROR: ApiError = {
  code: 'INTERNAL_ERROR',
  message: 'ランキングの取得に失敗しました。',
}

function createInitialState(): RankingDataState {
  return {
    entries: [],
    nextCursor: null,
    isInitialLoading: true,
    isRefreshing: false,
    isLoadingMore: false,
    initialError: null,
    refreshError: null,
    loadMoreError: null,
    hasNextPage: false,
  }
}

export function mergeRankingEntries(
  currentEntries: RankingEntry[],
  incomingEntries: RankingEntry[],
): RankingEntry[] {
  const merged = [...currentEntries]
  const indexByUserId = new Map(
    merged.map((entry, index) => [entry.userId, index]),
  )

  for (const entry of incomingEntries) {
    const existingIndex = indexByUserId.get(entry.userId)
    if (existingIndex === undefined) {
      indexByUserId.set(entry.userId, merged.length)
      merged.push(entry)
    } else {
      merged[existingIndex] = entry
    }
  }

  return merged
}

export function usePopulationRanking(
  api: RankingApi,
  pageSize = RANKING_PAGE_SIZE,
): PopulationRankingState {
  const [state, setState] = useState<RankingDataState>(createInitialState)
  const stateRef = useRef(state)
  const isMountedRef = useRef(false)
  const requestGenerationRef = useRef(0)
  const firstPagePromiseRef = useRef<Promise<void> | null>(null)
  const loadMorePromiseRef = useRef<Promise<void> | null>(null)

  const updateState = useCallback(
    (updater: (current: RankingDataState) => RankingDataState) => {
      setState((current) => {
        const next = updater(current)
        stateRef.current = next
        return next
      })
    },
    [],
  )

  const runFirstPage = useCallback(
    (mode: 'initial' | 'refresh'): Promise<void> => {
      const activeRequest = firstPagePromiseRef.current
      if (activeRequest) return activeRequest

      requestGenerationRef.current += 1
      const generation = requestGenerationRef.current
      loadMorePromiseRef.current = null

      updateState((current) =>
        mode === 'initial'
          ? createInitialState()
          : {
              ...current,
              isInitialLoading: false,
              isRefreshing: true,
              isLoadingMore: false,
              initialError: null,
              refreshError: null,
              loadMoreError: null,
            },
      )

      const promise = Promise.resolve()
        .then(() => api.getPopulationRanking({ limit: pageSize }))
        .then((result) => {
          if (
            !isMountedRef.current ||
            generation !== requestGenerationRef.current
          ) {
            return
          }

          if (result.ok) {
            updateState(() => ({
              entries: result.data.entries,
              nextCursor: result.data.nextCursor,
              isInitialLoading: false,
              isRefreshing: false,
              isLoadingMore: false,
              initialError: null,
              refreshError: null,
              loadMoreError: null,
              hasNextPage: result.data.nextCursor !== null,
            }))
            return
          }

          updateState((current) =>
            mode === 'initial'
              ? {
                  ...createInitialState(),
                  isInitialLoading: false,
                  initialError: result.error,
                }
              : {
                  ...current,
                  isRefreshing: false,
                  refreshError: result.error,
                },
          )
        })
        .catch(() => {
          if (
            !isMountedRef.current ||
            generation !== requestGenerationRef.current
          ) {
            return
          }

          updateState((current) =>
            mode === 'initial'
              ? {
                  ...createInitialState(),
                  isInitialLoading: false,
                  initialError: UNEXPECTED_ERROR,
                }
              : {
                  ...current,
                  isRefreshing: false,
                  refreshError: UNEXPECTED_ERROR,
                },
          )
        })
        .finally(() => {
          if (firstPagePromiseRef.current === promise) {
            firstPagePromiseRef.current = null
          }
        })

      firstPagePromiseRef.current = promise
      return promise
    },
    [api, pageSize, updateState],
  )

  const loadMore = useCallback((): Promise<void> => {
    const activeRequest = loadMorePromiseRef.current
    if (activeRequest) return activeRequest
    if (firstPagePromiseRef.current) return Promise.resolve()

    const cursor = stateRef.current.nextCursor
    if (cursor === null) return Promise.resolve()

    const generation = requestGenerationRef.current
    updateState((current) => ({
      ...current,
      isLoadingMore: true,
      loadMoreError: null,
    }))

    const promise = Promise.resolve()
      .then(() =>
        api.getPopulationRanking({ limit: pageSize, cursor }),
      )
      .then((result) => {
        if (
          !isMountedRef.current ||
          generation !== requestGenerationRef.current
        ) {
          return
        }

        if (result.ok) {
          updateState((current) => ({
            ...current,
            entries: mergeRankingEntries(
              current.entries,
              result.data.entries,
            ),
            nextCursor: result.data.nextCursor,
            isLoadingMore: false,
            loadMoreError: null,
            hasNextPage: result.data.nextCursor !== null,
          }))
          return
        }

        updateState((current) => ({
          ...current,
          isLoadingMore: false,
          loadMoreError: result.error,
        }))
      })
      .catch(() => {
        if (
          !isMountedRef.current ||
          generation !== requestGenerationRef.current
        ) {
          return
        }

        updateState((current) => ({
          ...current,
          isLoadingMore: false,
          loadMoreError: UNEXPECTED_ERROR,
        }))
      })
      .finally(() => {
        if (loadMorePromiseRef.current === promise) {
          loadMorePromiseRef.current = null
        }
      })

    loadMorePromiseRef.current = promise
    return promise
  }, [api, pageSize, updateState])

  const refresh = useCallback(
    () => runFirstPage('refresh'),
    [runFirstPage],
  )
  const retryInitial = useCallback(
    () => runFirstPage('initial'),
    [runFirstPage],
  )

  useEffect(() => {
    isMountedRef.current = true
    void runFirstPage('initial')

    return () => {
      isMountedRef.current = false
      requestGenerationRef.current += 1
      firstPagePromiseRef.current = null
      loadMorePromiseRef.current = null
    }
  }, [runFirstPage])

  return {
    entries: state.entries,
    isInitialLoading: state.isInitialLoading,
    isRefreshing: state.isRefreshing,
    isLoadingMore: state.isLoadingMore,
    initialError: state.initialError,
    refreshError: state.refreshError,
    loadMoreError: state.loadMoreError,
    hasNextPage: state.hasNextPage,
    refresh,
    loadMore,
    retryInitial,
    retryLoadMore: loadMore,
  }
}
