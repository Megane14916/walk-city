import type {
  BuildingCatalogItem,
  Cell,
  PlacementPreviewStatus,
  TownDetail,
} from '../types'
import {
  areCellsUnlocked,
  areCellsWithinMap,
  createOccupiedCellIndex,
  createRoadCellIndex,
  getOccupiedCells,
  hasAdjacentRoad,
  hasCollision,
} from './map-geometry'
import { hasTerrainCollision } from './map-terrain'

export type EvaluatePlacementPreviewInput = {
  town: TownDetail
  catalog: BuildingCatalogItem[]
  item: BuildingCatalogItem
  anchor: Cell
  operation: 'place' | 'move'
  excludedBuildingId?: string
}

export function evaluatePlacementPreview(
  input: EvaluatePlacementPreviewInput,
): PlacementPreviewStatus {
  const cells = getOccupiedCells(
    input.anchor,
    input.item.width,
    input.item.height,
  )

  if (
    !areCellsWithinMap(
      cells,
      input.town.town.mapWidth,
      input.town.town.mapHeight,
    )
  ) {
    return { status: 'invalid', reason: 'OUT_OF_MAP' }
  }

  if (!areCellsUnlocked(cells, input.town.unlockedAreas)) {
    return { status: 'invalid', reason: 'LAND_LOCKED' }
  }

  const occupiedCellIndex = createOccupiedCellIndex(
    input.town.buildings,
    input.catalog,
    input.town.obstacles,
    input.excludedBuildingId,
  )
  if (hasCollision(cells, occupiedCellIndex)) {
    return { status: 'invalid', reason: 'CELL_OCCUPIED' }
  }

  if (hasTerrainCollision(cells, input.town.mapLayout, 'river')) {
    return { status: 'invalid', reason: 'RIVER_BLOCKED' }
  }

  if (input.operation === 'place') {
    if (!input.item.enabled) {
      return { status: 'invalid', reason: 'CATALOG_ITEM_DISABLED' }
    }

    if (input.item.costCoins === null) {
      return { status: 'invalid', reason: 'PRICE_NOT_SET' }
    }

    const coins = input.town.town.coins
    if (coins === undefined) {
      return {
        status: 'unknown',
        message: 'コイン残高を確認できません。',
      }
    }

    if (coins < input.item.costCoins) {
      return { status: 'invalid', reason: 'INSUFFICIENT_COINS' }
    }
  }

  if (input.item.category !== 'road') {
    const roadCellIndex = createRoadCellIndex(
      input.town.buildings,
      input.catalog,
      input.excludedBuildingId,
    )
    if (!hasAdjacentRoad(cells, roadCellIndex)) {
      return { status: 'invalid', reason: 'ROAD_REQUIRED' }
    }
  }

  return { status: 'valid' }
}
