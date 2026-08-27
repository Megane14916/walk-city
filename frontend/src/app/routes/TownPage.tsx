import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../../features/auth/hooks'
import { TownOverview } from '../../features/town/components'
import { mockRankingApi } from '../../mocks/services'
import { paths } from '../paths'
import { useApi } from '../providers'

export function TownPage() {
  const { userId } = useParams<{ userId: string }>()
  const { googleIntegrationApi, townApi } = useApi()
  const { integrationState, state } = useAuth()
  const isPublicTown = userId !== undefined

  if (
    isPublicTown &&
    state.status === 'authenticated' &&
    userId === state.session.user.id
  ) {
    return <Navigate to={paths.root} replace />
  }

  const mode = isPublicTown
    ? { type: 'public' as const, userId }
    : { type: 'self' as const }

  return (
    <TownOverview
      api={townApi}
      googleApi={isPublicTown ? undefined : googleIntegrationApi}
      googleIntegrationState={isPublicTown ? undefined : integrationState}
      rankingApi={mockRankingApi}
      getUserHref={paths.user}
      mode={mode}
    />
  )
}
