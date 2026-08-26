export type RankingRequest = {
  limit?: number
  cursor?: string
}

export type RankingEntry = {
  rank: number
  userId: string
  displayName: string
  townId: string
  townName: string
  population: number
  isCurrentUser: boolean
}

export type RankingPage = {
  entries: RankingEntry[]
  nextCursor: string | null
}
