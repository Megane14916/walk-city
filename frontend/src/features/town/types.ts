import type { UserSummary } from '../../types/user'

export type Cell = {
    x: number
    y: number
}
export type UnlockedArea = {
    x: number
    y: number
    width: number
    height: number
}
export type PlacedBuilding = {
  id: string
  buildingTypeCode: string
  customName: string | null
  anchorX: number
  anchorY: number
  roadStructureId: string | null
  roadVariant: 'normal' | 'bridge_horizontal' | 'bridge_vertical' | null
  createdAt: string
  updatedAt: string
}
export type MapObstacle = {
  id: string
  type: string
  anchorX: number
  anchorY: number
  width: number
  height: number
}
export type MapTerrainArea = {
  id: string
  code: string
  terrainType: 'river' | string
  segmentKind: 'horizontal' | 'vertical' | 'corner' | string
  x: number
  y: number
  width: number
  height: number
  bridgeable: boolean
}
export type MapLayout = {
  id: string
  version: number
  bridgeCellCostCoins: number
  terrainAreas: MapTerrainArea[]
}
export type BuildingEffect = {
  type: string
  value: number | null
  targetCategory: string | null
  scope: string | null
  stackingRule: string | null
  description: string
  metadata: Record<string, unknown>
}
export type BuildingCatalogItem = {
  code: string
  name: string
  category: string
  width: 1 | 2
  height: 1 | 2
  costCoins: number | null
  enabled: boolean
  description: string
  effects: BuildingEffect[]
  assetKey: string
  catalogVersion: number
}
export type TownSummary = {
  id: string
  owner: UserSummary
  name: string
  coins?: number
  population: number
  mapWidth: 100
  mapHeight: 100
}
export type TownDetail = {
  town: TownSummary
  buildings: PlacedBuilding[]
  unlockedAreas: UnlockedArea[]
  obstacles: MapObstacle[]
  mapLayout: MapLayout
  catalogVersion: number
  editable: boolean
}
export type PlaceBuildingInput = {
  buildingTypeCode: string
  anchorX: number
  anchorY: number
  requestId: string
}
export type PlaceRoadLineInput = {
  buildingTypeCode: string
  cells: Cell[]
  requestId: string
}
export type DeleteRoadInput = {
  buildingId: string
  requestId: string
}
export type MoveBuildingInput = {
  buildingId: string
  anchorX: number
  anchorY: number
  requestId: string
}
export type RenameBuildingInput = {
  buildingId: string
  customName: string | null
}
export type RenameBuildingResult = {
  building: PlacedBuilding
  updatedAt: string
}
export type UnlockLandInput = {
  x: number
  y: number
  requestId: string
}
export type UnlockLandResult = {
  unlockedArea: UnlockedArea
  coinBalance: number
  updatedAt: string
}
export type TownMutationResult = {
  building: PlacedBuilding
  coinBalance: number
  population: number
  updatedAt: string
}
export type PlaceRoadLineResult = {
  buildings: PlacedBuilding[]
  placementKind: 'road' | 'bridge'
  roadStructureId: string | null
  totalCostCoins: number
  coinBalance: number
  population: number
  updatedAt: string
}
export type DeleteRoadResult = {
  deletionKind: 'road' | 'bridge'
  deletedBuildingIds: string[]
  deletedRoadStructureId: string | null
  coinBalance: number
  population: number
  updatedAt: string
}
export type PreviewInvalidReason =
  | 'OUT_OF_MAP'
  | 'LAND_LOCKED'
  | 'CELL_OCCUPIED'
  | 'CATALOG_ITEM_DISABLED'
  | 'PRICE_NOT_SET'
  | 'INSUFFICIENT_COINS'
  | 'ROAD_REQUIRED'
  | 'RIVER_BLOCKED'
export type PlacementPreviewStatus =
  | { status: 'valid' }
  | { status: 'invalid'; reason: PreviewInvalidReason }
  | { status: 'unknown'; message: string }
export type RoadLineInvalidReason =
  | PreviewInvalidReason
  | 'BRIDGE_SPAN_REQUIRED'
  | 'BRIDGE_DIRECTION_INVALID'
  | 'BRIDGE_CORNER_FORBIDDEN'
  | 'NO_NEW_ROAD_CELLS'
export type BridgeOrientation = 'horizontal' | 'vertical'
export type RoadLinePreview = {
  cells: Cell[]
  newCells: Cell[]
  placementKind: 'road' | 'bridge'
  bridgeOrientation: BridgeOrientation | null
  riverCells: Cell[]
  approachCells: Cell[]
  totalCostCoins: number
  status:
    | { status: 'valid' }
    | { status: 'invalid'; reason: RoadLineInvalidReason }
    | { status: 'unknown'; message: string }
}
export type LandUnlockInvalidReason =
  | 'OUT_OF_MAP'
  | 'AREA_ALREADY_UNLOCKED'
  | 'AREA_NOT_ADJACENT'
  | 'INSUFFICIENT_COINS'
export type LandUnlockPreviewStatus =
  | { status: 'valid' }
  | { status: 'invalid'; reason: LandUnlockInvalidReason }
export type MapMode =
  | { type: 'idle' }
  | {
      type: 'placing'
      item: BuildingCatalogItem
      anchor: Cell | null
      requestId: string
    }
  | {
      type: 'moving'
      buildingId: string
      anchor: Cell | null
      requestId: string
    }
  | {
      type: 'submitting'
      operation: 'place' | 'move'
    }
