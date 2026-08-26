import { TownOverview } from '../../features/town/components'
import { mockGoogleIntegrationApi } from '../../features/auth/api'
import { mockRankingApi, mockTownApi } from '../../mocks/services'
import { paths } from '../paths'

export function TownPage() {
  return (
    <TownOverview
      api={mockTownApi}
      googleApi={mockGoogleIntegrationApi}
      rankingApi={mockRankingApi}
      getUserHref={paths.user}
    />
  )
}
