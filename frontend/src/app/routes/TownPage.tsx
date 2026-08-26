import { TownOverview } from '../../features/town/components'
import {
  mockRankingApi,
  mockTownApi,
} from '../../mocks/services'
import { paths } from '../paths'
import { useApi } from '../providers'

export function TownPage() {
  const { googleIntegrationApi } = useApi()

  return (
    <TownOverview
      api={mockTownApi}
      googleApi={googleIntegrationApi}
      rankingApi={mockRankingApi}
      getUserHref={paths.user}
    />
  )
}
