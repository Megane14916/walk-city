import type {
  BuildingCatalogItem,
  Cell,
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

export function evaluateRoadLinePreview(input: {
  town: TownDetail
  catalog: BuildingCatalogItem[]
  item: BuildingCatalogItem
  cells: Cell[]
}): RoadLinePreview {
  const emptyResult = {
    cells: input.cells,
    newCells: [] as Cell[],
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

  const roadIndex = createRoadCellIndex(input.town.buildings, input.catalog)
  const occupiedIndex = createOccupiedCellIndex(
    input.town.buildings,
    input.catalog,
    input.town.obstacles,
  )
  const collidesWithNonRoad = input.cells.some((cell) => {
    const key = getCellKey(cell)
    return occupiedIndex.has(key) && !roadIndex.has(key)
  })
  if (collidesWithNonRoad) {
    return {
      ...emptyResult,
      status: { status: 'invalid', reason: 'CELL_OCCUPIED' },
    }
  }

  const newCells = input.cells.filter((cell) => !roadIndex.has(getCellKey(cell)))
  const totalCostCoins = input.item.costCoins * newCells.length
  const result = { cells: input.cells, newCells, totalCostCoins }
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
