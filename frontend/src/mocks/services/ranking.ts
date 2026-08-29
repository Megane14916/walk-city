import type { RankingApi } from '../../features/ranking/api'
import type {
  RankingEntry,
  RankingPage,
  RankingRequest,
} from '../../features/ranking/types'
import type { ApiErrorCode, ApiResult } from '../../types/common'
import { MOCK_RANKING_ENTRIES } from '../data/rankings'
import type { MockWalkCityStore } from './walk-city-store'

export const DEFAULT_RANKING_PAGE_SIZE = 20

export type MockRankingRequestKind = 'initial' | 'loadMore'

export type MockRankingErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'INTERNAL_ERROR'

export type MockRankingApiOptions = {
  latencyMs?: number
  entries?: RankingEntry[]
  store?: MockWalkCityStore
}

export type MockRankingApi = RankingApi & {
  setFailure(
    requestKind: MockRankingRequestKind,
    code: MockRankingErrorCode | null,
    options?: { once?: boolean },
  ): void
  reset(): void
}

type ConfiguredFailure = {
  code: MockRankingErrorCode
  once: boolean
}

const CURSOR_PREFIX = 'mock-ranking-cursor-v1:'

const errorMessages: Record<MockRankingErrorCode, string> = {
  UNAUTHENTICATED: 'ランキングを見るにはログインしてください。',
  INVALID_INPUT: 'ランキングの取得条件が正しくありません。',
  INTERNAL_ERROR: 'ランキングの取得に失敗しました。',
}

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function failure<T>(code: MockRankingErrorCode): ApiResult<T> {
  return {
    ok: false,
    error: {
      code: code satisfies ApiErrorCode,
      message: errorMessages[code],
    },
  }
}

function copyEntry(entry: RankingEntry): RankingEntry {
  return { ...entry }
}

function createRankingSnapshot(
  entries: RankingEntry[],
  store: MockWalkCityStore | undefined,
): RankingEntry[] {
  const snapshot = entries.map(copyEntry)
  if (!store) return snapshot

  const currentTown = store.getMutableTown().town
  const currentUserIndex = snapshot.findIndex((entry) => entry.isCurrentUser)
  if (currentUserIndex === -1) return snapshot

  snapshot[currentUserIndex] = {
    ...snapshot[currentUserIndex],
    userId: currentTown.owner.id,
    displayName: currentTown.owner.displayName,
    townId: currentTown.id,
    townName: currentTown.name,
    population: currentTown.population,
  }

  snapshot.sort(
    (left, right) =>
      right.population - left.population ||
      left.displayName.localeCompare(right.displayName, 'ja') ||
      left.userId.localeCompare(right.userId),
  )

  let previousPopulation: number | null = null
  let rank = 0
  return snapshot.map((entry, index) => {
    if (entry.population !== previousPopulation) {
      rank = index + 1
      previousPopulation = entry.population
    }
    return { ...entry, rank }
  })
}

function createCursor(offset: number): string {
  return `${CURSOR_PREFIX}${offset}`
}

function readCursor(cursor: string, entryCount: number): number | null {
  if (!cursor.startsWith(CURSOR_PREFIX)) return null

  const offsetText = cursor.slice(CURSOR_PREFIX.length)
  if (!/^\d+$/.test(offsetText)) return null

  const offset = Number(offsetText)
  if (!Number.isSafeInteger(offset) || offset <= 0 || offset >= entryCount) {
    return null
  }

  return offset
}

export function createMockRankingApi(
  options: MockRankingApiOptions = {},
): MockRankingApi {
  const latencyMs = options.latencyMs ?? 150
  const entries = (options.entries ?? MOCK_RANKING_ENTRIES).map(copyEntry)
  const store = options.store
  const failures = new Map<MockRankingRequestKind, ConfiguredFailure>()

  const wait = async () => {
    if (latencyMs <= 0) return
    await new Promise<void>((resolve) =>
      globalThis.setTimeout(resolve, latencyMs),
    )
  }

  const configuredFailure = <T>(
    requestKind: MockRankingRequestKind,
  ): ApiResult<T> | null => {
    const configured = failures.get(requestKind)
    if (!configured) return null
    if (configured.once) failures.delete(requestKind)
    return failure<T>(configured.code)
  }

  return {
    async getPopulationRanking(input: RankingRequest) {
      await wait()

      const rankingSnapshot = createRankingSnapshot(entries, store)

      const limit = input.limit ?? DEFAULT_RANKING_PAGE_SIZE
      if (!Number.isInteger(limit) || limit <= 0) {
        return failure('INVALID_INPUT')
      }

      let offset = 0
      let requestKind: MockRankingRequestKind = 'initial'
      if (input.cursor !== undefined) {
        if (input.cursor.length === 0) return failure('INVALID_INPUT')
        const parsedOffset = readCursor(input.cursor, rankingSnapshot.length)
        if (parsedOffset === null) return failure('INVALID_INPUT')
        offset = parsedOffset
        requestKind = 'loadMore'
      }

      const failed = configuredFailure<RankingPage>(requestKind)
      if (failed) return failed

      const pageEntries = rankingSnapshot
        .slice(offset, offset + limit)
        .map(copyEntry)
      const nextOffset = offset + pageEntries.length
      const nextCursor =
        nextOffset < rankingSnapshot.length ? createCursor(nextOffset) : null

      return success({ entries: pageEntries, nextCursor })
    },

    setFailure(requestKind, code, failureOptions = {}) {
      if (code === null) {
        failures.delete(requestKind)
        return
      }

      failures.set(requestKind, {
        code,
        once: failureOptions.once ?? false,
      })
    },

    reset() {
      failures.clear()
    },
  }
}

export const mockRankingApi = createMockRankingApi()
