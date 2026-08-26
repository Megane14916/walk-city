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
  anchorX: number
  anchorY: number
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
  catalogVersion: number
  editable: boolean
}
export type PlaceBuildingInput = {
  buildingTypeCode: string
  anchorX: number
  anchorY: number
  requestId: string
}
export type MoveBuildingInput = {
  buildingId: string
  anchorX: number
  anchorY: number
  requestId: string
}
export type TownMutationResult = {
  building: PlacedBuilding
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
export type PlacementPreviewStatus =
  | { status: 'valid' }
  | { status: 'invalid'; reason: PreviewInvalidReason }
  | { status: 'unknown'; message: string }
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