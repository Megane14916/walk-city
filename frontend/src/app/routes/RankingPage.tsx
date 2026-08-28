import { PopulationRanking } from '../../features/ranking/components'
import { paths } from '../paths'
import { useApi } from '../providers'

export function RankingPage() {
  const { rankingApi } = useApi()

  return (
    <PopulationRanking api={rankingApi} getUserHref={paths.user} />
  )
}
