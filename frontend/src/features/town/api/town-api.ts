import type { ApiResult } from '../../../types/common'
import type {
  BuildingCatalogItem,
  MoveBuildingInput,
  PlaceBuildingInput,
  TownDetail,
  TownMutationResult,
} from '../types'

export interface TownApi {
  getBuildingCatalog(): Promise<ApiResult<BuildingCatalogItem[]>>
  getMyTown(): Promise<ApiResult<TownDetail>>
  getPublicTown(userId: string): Promise<ApiResult<TownDetail>>
  placeBuilding(
    input: PlaceBuildingInput,
  ): Promise<ApiResult<TownMutationResult>>
  moveBuilding(
    input: MoveBuildingInput,
  ): Promise<ApiResult<TownMutationResult>>
}
