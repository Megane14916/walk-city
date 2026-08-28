import type { PublicUserApi } from '../hooks'
import { usePublicUserProfile } from '../hooks'
import { UserProfileErrorState } from './UserProfileErrorState'
import { UserProfileSkeleton } from './UserProfileSkeleton'
import { UserProfileSummary } from './UserProfileSummary'

export type PublicUserProfileViewProps = {
  api: PublicUserApi
  userId: string
  loginHref: string
  rankingHref: string
  townHref: string
}

export function PublicUserProfileView({
  api,
  userId,
  loginHref,
  rankingHref,
  townHref,
}: PublicUserProfileViewProps) {
  const profileState = usePublicUserProfile(api, userId)

  if (profileState.isLoading) {
    return <UserProfileSkeleton />
  }

  if (profileState.error) {
    return (
      <UserProfileErrorState
        error={profileState.error}
        loginHref={loginHref}
        rankingHref={rankingHref}
        onRetry={() => void profileState.retry()}
      />
    )
  }

  if (!profileState.profile) {
    return (
      <UserProfileErrorState
        error={{
          code: 'INTERNAL_ERROR',
          message: 'ユーザー情報を読み込めませんでした。',
        }}
        loginHref={loginHref}
        rankingHref={rankingHref}
        onRetry={() => void profileState.retry()}
      />
    )
  }

  return (
    <UserProfileSummary
      profile={profileState.profile}
      rankingHref={rankingHref}
      townHref={townHref}
    />
  )
}
