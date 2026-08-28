import type { TownDetail } from '../../town/types'
import type { ApiResult } from '../../../types/common'
import type { PublicUserProfile } from '../types'

const CONTRACT_ERROR_MESSAGE = 'ユーザー情報を読み込めませんでした。'

function contractError(): ApiResult<PublicUserProfile> {
  return {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: CONTRACT_ERROR_MESSAGE,
    },
  }
}

export function toPublicUserProfile(
  requestedUserId: string,
  detail: TownDetail,
): ApiResult<PublicUserProfile> {
  const { town } = detail

  if (
    requestedUserId.trim() === '' ||
    town.owner.id !== requestedUserId ||
    town.owner.id.trim() === '' ||
    town.id.trim() === '' ||
    town.owner.displayName.trim() === '' ||
    town.name.trim() === '' ||
    detail.editable !== false ||
    !Number.isFinite(town.population) ||
    !Number.isInteger(town.population) ||
    town.population < 0
  ) {
    return contractError()
  }

  return {
    ok: true,
    data: {
      id: town.owner.id,
      displayName: town.owner.displayName,
      town: {
        id: town.id,
        name: town.name,
        population: town.population,
      },
    },
  }
}
