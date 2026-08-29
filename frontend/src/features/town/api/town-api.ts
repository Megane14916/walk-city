import type { ApiResult } from '../../../types/common'
import type {
  BuildingCatalogItem,
  DeleteRoadInput,
  DeleteRoadResult,
  MoveBuildingInput,
  PlaceBuildingInput,
  PlaceRoadLineInput,
  PlaceRoadLineResult,
  RenameBuildingInput,
  RenameBuildingResult,
  TownDetail,
  TownMutationResult,
  UnlockLandInput,
  UnlockLandResult,
} from '../types'

export interface TownApi {
  getBuildingCatalog(): Promise<ApiResult<BuildingCatalogItem[]>>
  getMyTown(): Promise<ApiResult<TownDetail>>
  getPublicTown(userId: string): Promise<ApiResult<TownDetail>>
  placeBuilding(
    input: PlaceBuildingInput,
  ): Promise<ApiResult<TownMutationResult>>
  placeRoadLine(
    input: PlaceRoadLineInput,
  ): Promise<ApiResult<PlaceRoadLineResult>>
  moveBuilding(
    input: MoveBuildingInput,
  ): Promise<ApiResult<TownMutationResult>>
  deleteRoad(input: DeleteRoadInput): Promise<ApiResult<DeleteRoadResult>>
  renameBuilding(
    input: RenameBuildingInput,
  ): Promise<ApiResult<RenameBuildingResult>>
  unlockLand(input: UnlockLandInput): Promise<ApiResult<UnlockLandResult>>
}
