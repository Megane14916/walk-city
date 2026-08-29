import type {
  BridgeOrientation,
  BuildingCatalogItem,
  Cell,
  MapLayout,
  MapTerrainArea,
  RoadLineInvalidReason,
  RoadLinePreview,
  TownDetail,
} from '../types'
import {
  areCellsUnlocked,
  areCellsWithinMap,
  createOccupiedCellIndex,
  createRoadCellIndex,
  getCellKey,
} from './map-geometry'
import { getTerrainAreaAtCell } from './map-terrain'

export type BridgeLineClassification =
  | { kind: 'road' }
  | {
      kind: 'bridge'
      orientation: BridgeOrientation
      cells: Cell[]
      riverCells: Cell[]
      approachCells: Cell[]
    }
  | {
      kind: 'invalid-bridge'
      reason:
        | 'BRIDGE_SPAN_REQUIRED'
        | 'BRIDGE_DIRECTION_INVALID'
        | 'BRIDGE_CORNER_FORBIDDEN'
    }

export function getRoadLineCells(start: Cell, end: Cell): Cell[] {
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
  const cells: Cell[] = []

  if (horizontal) {
    const firstX = Math.min(start.x, end.x)
    const lastX = Math.max(start.x, end.x)
    for (let x = firstX; x <= lastX; x += 1) {
      cells.push({ x, y: start.y })
    }
    return cells
  }

  const firstY = Math.min(start.y, end.y)
  const lastY = Math.max(start.y, end.y)
  for (let y = firstY; y <= lastY; y += 1) {
    cells.push({ x: start.x, y })
  }
  return cells
}

export function isStraightRoadLine(cells: Cell[]): boolean {
  if (cells.length === 0) return false
  const keys = new Set(cells.map(getCellKey))
  if (keys.size !== cells.length) return false

  const expected = getRoadLineCells(cells[0], cells[cells.length - 1])
  return (
    expected.length === cells.length &&
    expected.every((cell) => keys.has(getCellKey(cell)))
  )
}

export function classifyBridgeLine(
  cells: Cell[],
  layout: MapLayout,
): BridgeLineClassification {
  const riverAreas = cells.map((cell) =>
    getTerrainAreaAtCell(layout, cell, 'river'),
  )
  if (riverAreas.every((area) => area === null)) return { kind: 'road' }

  if (riverAreas.some((area) => area?.segmentKind === 'corner')) {
    return { kind: 'invalid-bridge', reason: 'BRIDGE_CORNER_FORBIDDEN' }
  }

  const bridgeableAreas = riverAreas.filter(
    (area): area is MapTerrainArea => area !== null && area.bridgeable,
  )
  const bridgeableAreaIds = new Set(bridgeableAreas.map((area) => area.id))
  if (bridgeableAreaIds.size !== 1 || bridgeableAreas.length === 0) {
    return { kind: 'invalid-bridge', reason: 'BRIDGE_SPAN_REQUIRED' }
  }

  const bridgeableArea = bridgeableAreas[0]
  const horizontalLine = cells.every((cell) => cell.y === cells[0].y)
  const verticalLine = cells.every((cell) => cell.x === cells[0].x)
  const orientation: BridgeOrientation | null = horizontalLine
    ? 'horizontal'
    : verticalLine
      ? 'vertical'
      : null
  const directionIsValid =
    (bridgeableArea.segmentKind === 'vertical' &&
      orientation === 'horizontal') ||
    (bridgeableArea.segmentKind === 'horizontal' &&
      orientation === 'vertical')
  if (!directionIsValid || orientation === null) {
    return { kind: 'invalid-bridge', reason: 'BRIDGE_DIRECTION_INVALID' }
  }

  if (cells.length !== 7) {
    return { kind: 'invalid-bridge', reason: 'BRIDGE_SPAN_REQUIRED' }
  }

  const orderedCells = getRoadLineCells(cells[0], cells[cells.length - 1])
  const orderedAreas = orderedCells.map((cell) =>
    getTerrainAreaAtCell(layout, cell, 'river'),
  )
  const riverCells = orderedCells.slice(1, 6)
  const approachCells = [orderedCells[0], orderedCells[6]]
  const hasExpectedSpan =
    orderedAreas[0] === null &&
    orderedAreas[6] === null &&
    orderedAreas.slice(1, 6).every((area) => area?.id === bridgeableArea.id)
  if (!hasExpectedSpan) {
    return { kind: 'invalid-bridge', reason: 'BRIDGE_SPAN_REQUIRED' }
  }

  return {
    kind: 'bridge',
    orientation,
    cells: orderedCells,
    riverCells,
    approachCells,
  }
}

export function evaluateRoadLinePreview(input: {
  town: TownDetail
  catalog: BuildingCatalogItem[]
  item: BuildingCatalogItem
  cells: Cell[]
}): RoadLinePreview {
  const emptyResult = {
    cells: input.cells,
    newCells: [] as Cell[],
    placementKind: 'road' as const,
    bridgeOrientation: null,
    riverCells: [] as Cell[],
    approachCells: [] as Cell[],
    totalCostCoins: 0,
  }

  if (!isStraightRoadLine(input.cells)) {
    return {
      ...emptyResult,
      status: { status: 'invalid', reason: 'OUT_OF_MAP' },
    }
  }
  if (
    !areCellsWithinMap(
      input.cells,
      input.town.town.mapWidth,
      input.town.town.mapHeight,
    )
  ) {
    return {
      ...emptyResult,
      status: { status: 'invalid', reason: 'OUT_OF_MAP' },
    }
  }
  if (!areCellsUnlocked(input.cells, input.town.unlockedAreas)) {
    return {
      ...emptyResult,
      status: { status: 'invalid', reason: 'LAND_LOCKED' },
    }
  }
  if (!input.item.enabled) {
    return {
      ...emptyResult,
      status: { status: 'invalid', reason: 'CATALOG_ITEM_DISABLED' },
    }
  }
  if (input.item.costCoins === null) {
    return {
      ...emptyResult,
      status: { status: 'invalid', reason: 'PRICE_NOT_SET' },
    }
  }

  const bridgeClassification = classifyBridgeLine(
    input.cells,
    input.town.mapLayout,
  )
  if (bridgeClassification.kind === 'invalid-bridge') {
    return {
      ...emptyResult,
      placementKind: 'bridge',
      status: {
        status: 'invalid',
        reason: bridgeClassification.reason satisfies RoadLineInvalidReason,
      },
    }
  }

  const roadIndex = createRoadCellIndex(input.town.buildings, input.catalog)
  const occupiedIndex = createOccupiedCellIndex(
    input.town.buildings,
    input.catalog,
    input.town.obstacles,
  )
  const hasOccupiedCell = input.cells.some((cell) => {
    const key = getCellKey(cell)
    return bridgeClassification.kind === 'bridge'
      ? occupiedIndex.has(key)
      : occupiedIndex.has(key) && !roadIndex.has(key)
  })
  if (hasOccupiedCell) {
    return {
      ...emptyResult,
      placementKind:
        bridgeClassification.kind === 'bridge' ? 'bridge' : 'road',
      status: { status: 'invalid', reason: 'CELL_OCCUPIED' },
    }
  }

  const isBridge = bridgeClassification.kind === 'bridge'
  const newCells = isBridge
    ? bridgeClassification.cells
    : input.cells.filter((cell) => !roadIndex.has(getCellKey(cell)))
  const totalCostCoins = isBridge
    ? input.town.mapLayout.bridgeCellCostCoins * 5 + input.item.costCoins * 2
    : input.item.costCoins * newCells.length
  const result = {
    cells: input.cells,
    newCells,
    placementKind: isBridge ? ('bridge' as const) : ('road' as const),
    bridgeOrientation: isBridge ? bridgeClassification.orientation : null,
    riverCells: isBridge ? bridgeClassification.riverCells : [],
    approachCells: isBridge ? bridgeClassification.approachCells : [],
    totalCostCoins,
  }
  if (newCells.length === 0) {
    return {
      ...result,
      status: { status: 'invalid', reason: 'NO_NEW_ROAD_CELLS' },
    }
  }

  const coins = input.town.town.coins
  if (coins === undefined) {
    return {
      ...result,
      status: { status: 'unknown', message: 'コイン残高を確認できません。' },
    }
  }
  if (coins < totalCostCoins) {
    return {
      ...result,
      status: { status: 'invalid', reason: 'INSUFFICIENT_COINS' },
    }
  }

  return { ...result, status: { status: 'valid' } }
}
