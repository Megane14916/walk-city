import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseFailure } from '../../../lib/supabase-api'
import type { ApiResult } from '../../../types/common'
import type { RankingApi } from '../api'
import type { RankingEntry, RankingPage, RankingRequest } from '../types'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const CURSOR_PATTERN = /^offset:(0|[1-9]\d*)$/
const RANKING_COLUMNS = [
  'rank',
  'user_id',
  'display_name',
  'town_id',
  'town_name',
  'population',
].join(',')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toSafeInteger(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : undefined
  }
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

function mapEntry(value: unknown, currentUserId: string): RankingEntry | null {
  if (!isRecord(value)) return null
  const rank = toSafeInteger(value.rank)
  const population = toSafeInteger(value.population)
  if (
    rank === undefined ||
    rank <= 0 ||
    population === undefined ||
    population < 0 ||
    typeof value.user_id !== 'string' ||
    value.user_id.length === 0 ||
    typeof value.display_name !== 'string' ||
    value.display_name.length === 0 ||
    typeof value.town_id !== 'string' ||
    value.town_id.length === 0 ||
    typeof value.town_name !== 'string' ||
    value.town_name.length === 0
  ) {
    return null
  }

  return {
    rank,
    userId: value.user_id,
    displayName: value.display_name,
    townId: value.town_id,
    townName: value.town_name,
    population,
    isCurrentUser: value.user_id === currentUserId,
  }
}

function parseRequest(input: RankingRequest):
  | { ok: true; limit: number; offset: number }
  | { ok: false } {
  const limit = input.limit ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { ok: false }
  }
  if (input.cursor === undefined) return { ok: true, limit, offset: 0 }
  const match = CURSOR_PATTERN.exec(input.cursor)
  if (!match) return { ok: false }
  const offset = Number(match[1])
  return Number.isSafeInteger(offset)
    ? { ok: true, limit, offset }
    : { ok: false }
}

export function createSupabaseRankingApi(
  supabase: SupabaseClient,
): RankingApi {
  return {
    async getPopulationRanking(input): Promise<ApiResult<RankingPage>> {
      const request = parseRequest(input)
      if (!request.ok) {
        return {
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'ランキングの取得条件を確認してください。',
          },
        }
      }

      try {
        const authResult = await supabase.auth.getUser()
        if (authResult.error || !authResult.data.user) {
          return supabaseFailure(authResult.error, {
            fallbackCode: 'UNAUTHENTICATED',
            fallbackMessage: 'Googleでログインしてください。',
          })
        }

        const { data, error } = await supabase
          .from('population_ranking_view')
          .select(RANKING_COLUMNS)
          .order('population', { ascending: false })
          .order('display_name', { ascending: true })
          .order('user_id', { ascending: true })
          .range(request.offset, request.offset + request.limit)

        if (error) {
          return supabaseFailure(error, {
            fallbackMessage: 'ランキングを取得できませんでした。',
          })
        }
        if (!Array.isArray(data)) {
          throw new Error('Invalid ranking response')
        }

        const entries = data
          .slice(0, request.limit)
          .map((row) => mapEntry(row, authResult.data.user.id))
        if (entries.some((entry) => entry === null)) {
          throw new Error('Invalid ranking entry')
        }

        return {
          ok: true,
          data: {
            entries: entries as RankingEntry[],
            nextCursor:
              data.length > request.limit
                ? `offset:${request.offset + request.limit}`
                : null,
          },
        }
      } catch {
        return {
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'ランキングを取得できませんでした。',
          },
        }
      }
    },
  }
}
