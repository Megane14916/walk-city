import type {
  BuildingCatalogItem,
  Cell,
  MapObstacle,
  PlacedBuilding,
  UnlockedArea,
} from '../types'

export type ScreenPointToCellInput = {
  pointerX: number
  pointerY: number
  viewportLeft: number
  viewportTop: number
  panX: number
  panY: number
  zoom: number
  cellSize: number
  mapWidth: number
  mapHeight: number
}

export function getOccupiedCells(
  anchor: Cell,
  width: number,
  height: number,
): Cell[] {
  const cells: Cell[] = []

  for (let y = anchor.y; y < anchor.y + height; y += 1) {
    for (let x = anchor.x; x < anchor.x + width; x += 1) {
      cells.push({ x, y })
    }
  }

  return cells
}
export function getCellKey(cell: Cell): string {
  return `${cell.x}:${cell.y}`
}
export function isCellWithinMap(
  cell: Cell,
  mapWidth: number,
  mapHeight: number,
): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.y) &&
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < mapWidth &&
    cell.y < mapHeight
  )
}
export function areCellsWithinMap(
  cells: Cell[],
  mapWidth: number,
  mapHeight: number,
): boolean {
  return (
    cells.length > 0 &&
    cells.every((cell) => isCellWithinMap(cell, mapWidth, mapHeight))
  )
}
export function isCellUnlocked(
  cell: Cell,
  unlockedAreas: UnlockedArea[],
): boolean {
  return unlockedAreas.some(
    (area) =>
      cell.x >= area.x &&
      cell.x < area.x + area.width &&
      cell.y >= area.y &&
      cell.y < area.y + area.height,
  )
}
export function areCellsUnlocked(
  cells: Cell[],
  unlockedAreas: UnlockedArea[],
): boolean {
  return (
    cells.length > 0 &&
    cells.every((cell) => isCellUnlocked(cell, unlockedAreas))
  )
}
export function hasCollision(
  cells: Cell[],
  occupiedCellIndex: ReadonlySet<string>,
): boolean {
  return cells.some((cell) => occupiedCellIndex.has(getCellKey(cell)))
}
export function createCellIndex(cells: Cell[]): Set<string> {
  return new Set(cells.map((cell) => getCellKey(cell)))
}
export function getPlacedBuildingCells(
  building: PlacedBuilding,
  catalog: BuildingCatalogItem[],
): Cell[] {
  const catalogItem = catalog.find(
    (item) => item.code === building.buildingTypeCode,
  )

  if (!catalogItem) {
    return []
  }

  return getOccupiedCells(
    {
      x: building.anchorX,
      y: building.anchorY,
    },
    catalogItem.width,
    catalogItem.height,
  )
}

export function getObstacleCells(obstacle: MapObstacle): Cell[] {
  return getOccupiedCells(
    {
      x: obstacle.anchorX,
      y: obstacle.anchorY,
    },
    obstacle.width,
    obstacle.height,
  )
}

export function createOccupiedCellIndex(
  buildings: PlacedBuilding[],
  catalog: BuildingCatalogItem[],
  obstacles: MapObstacle[],
  excludedBuildingId?: string,
): Set<string> {
  const cells = [
    ...buildings
      .filter((building) => building.id !== excludedBuildingId)
      .flatMap((building) => getPlacedBuildingCells(building, catalog)),
    ...obstacles.flatMap((obstacle) => getObstacleCells(obstacle)),
  ]

  return createCellIndex(cells)
}

export function createRoadCellIndex(
  buildings: PlacedBuilding[],
  catalog: BuildingCatalogItem[],
  excludedBuildingId?: string,
): Set<string> {
  const roadCodes = new Set(
    catalog
      .filter((item) => item.category === 'road')
      .map((item) => item.code),
  )

  const roadCells = buildings
    .filter(
      (building) =>
        building.id !== excludedBuildingId &&
        roadCodes.has(building.buildingTypeCode),
    )
    .flatMap((building) => getPlacedBuildingCells(building, catalog))

  return createCellIndex(roadCells)
}

export function hasAdjacentRoad(
  cells: Cell[],
  roadCellIndex: ReadonlySet<string>,
): boolean {
  return cells.some((cell) => {
    const neighbors: Cell[] = [
      { x: cell.x - 1, y: cell.y },
      { x: cell.x + 1, y: cell.y },
      { x: cell.x, y: cell.y - 1 },
      { x: cell.x, y: cell.y + 1 },
    ]

    return neighbors.some((neighbor) =>
      roadCellIndex.has(getCellKey(neighbor)),
    )
  })
}

export function screenPointToCell(
  input: ScreenPointToCellInput,
): Cell | null {
  const values = [
    input.pointerX,
    input.pointerY,
    input.viewportLeft,
    input.viewportTop,
    input.panX,
    input.panY,
    input.zoom,
    input.cellSize,
    input.mapWidth,
    input.mapHeight,
  ]

  if (
    values.some((value) => !Number.isFinite(value)) ||
    input.zoom <= 0 ||
    input.cellSize <= 0 ||
    !Number.isInteger(input.mapWidth) ||
    !Number.isInteger(input.mapHeight) ||
    input.mapWidth <= 0 ||
    input.mapHeight <= 0
  ) {
    return null
  }

  const worldPixelX =
    (input.pointerX - input.viewportLeft - input.panX) / input.zoom
  const worldPixelY =
    (input.pointerY - input.viewportTop - input.panY) / input.zoom
  const cell = {
    x: Math.floor(worldPixelX / input.cellSize),
    y: Math.floor(worldPixelY / input.cellSize),
  }

  return isCellWithinMap(cell, input.mapWidth, input.mapHeight)
    ? cell
    : null
}
