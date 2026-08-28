import { useParams } from 'react-router-dom'
import { PublicUserProfileView } from '../../features/user/components'
import { paths } from '../paths'
import { useApi } from '../providers'

export function UserPage() {
  const { userId } = useParams<{ userId: string }>()
  const { townApi } = useApi()
  const requestedUserId = userId ?? ''

  return (
    <PublicUserProfileView
      api={townApi}
      userId={requestedUserId}
      loginHref={paths.login}
      rankingHref={paths.ranking}
      townHref={
        requestedUserId.trim() === ''
          ? paths.root
          : paths.town(requestedUserId)
      }
    />
  )
}
