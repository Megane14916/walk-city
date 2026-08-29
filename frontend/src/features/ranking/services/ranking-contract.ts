import type { RankingEntry, RankingPage } from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveSafeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  )
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  )
}

export function isRankingEntry(value: unknown): value is RankingEntry {
  return (
    isRecord(value) &&
    isPositiveSafeInteger(value.rank) &&
    isNonEmptyString(value.userId) &&
    isNonEmptyString(value.displayName) &&
    isNonEmptyString(value.townId) &&
    isNonEmptyString(value.townName) &&
    isNonNegativeSafeInteger(value.population) &&
    typeof value.isCurrentUser === 'boolean'
  )
}

export function isRankingPage(value: unknown): value is RankingPage {
  return (
    isRecord(value) &&
    Array.isArray(value.entries) &&
    value.entries.every(isRankingEntry) &&
    (value.nextCursor === null || typeof value.nextCursor === 'string')
  )
}
