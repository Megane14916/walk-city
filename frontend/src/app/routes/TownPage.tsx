import { TownOverview } from '../../features/town/components'
import { useAuth } from '../../features/auth/hooks'
import {
  mockRankingApi,
  mockTownApi,
} from '../../mocks/services'
import { paths } from '../paths'
import { useApi } from '../providers'

export function TownPage() {
  const { googleIntegrationApi } = useApi()
  const { integrationState } = useAuth()

  return (
    <TownOverview
      api={mockTownApi}
      googleApi={googleIntegrationApi}
      googleIntegrationState={integrationState}
      rankingApi={mockRankingApi}
      getUserHref={paths.user}
    />
  )
}
