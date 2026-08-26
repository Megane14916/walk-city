import { PopulationRanking } from '../../features/ranking/components'
import { mockRankingApi } from '../../mocks/services'
import { paths } from '../paths'

export function RankingPage() {
  return (
    <PopulationRanking api={mockRankingApi} getUserHref={paths.user} />
  )
}
