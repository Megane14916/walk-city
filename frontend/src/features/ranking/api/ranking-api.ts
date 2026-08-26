import type { ApiResult } from '../../../types/common'
import type { RankingPage, RankingRequest } from '../types'

export interface RankingApi {
  getPopulationRanking(
    input: RankingRequest,
  ): Promise<ApiResult<RankingPage>>
}
