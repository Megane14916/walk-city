import type { Cell, MapLayout, MapTerrainArea } from '../types'
import { getCellKey } from './map-geometry'

export function isCellInTerrainArea(
  cell: Cell,
  area: MapTerrainArea,
): boolean {
  return (
    cell.x >= area.x &&
    cell.x < area.x + area.width &&
    cell.y >= area.y &&
    cell.y < area.y + area.height
  )
}

export function getTerrainAreaAtCell(
  layout: MapLayout,
  cell: Cell,
  terrainType?: string,
): MapTerrainArea | null {
  return (
    layout.terrainAreas.find(
      (area) =>
        (terrainType === undefined || area.terrainType === terrainType) &&
        isCellInTerrainArea(cell, area),
    ) ?? null
  )
}

export function hasTerrainCollision(
  cells: Cell[],
  layout: MapLayout,
  terrainType: string,
): boolean {
  return cells.some(
    (cell) => getTerrainAreaAtCell(layout, cell, terrainType) !== null,
  )
}

export function createTerrainCellIndex(
  layout: MapLayout,
  terrainType: string,
): Set<string> {
  const cellKeys = new Set<string>()

  for (const area of layout.terrainAreas) {
    if (area.terrainType !== terrainType) continue
    for (let y = area.y; y < area.y + area.height; y += 1) {
      for (let x = area.x; x < area.x + area.width; x += 1) {
        cellKeys.add(getCellKey({ x, y }))
      }
    }
  }

  return cellKeys
}
