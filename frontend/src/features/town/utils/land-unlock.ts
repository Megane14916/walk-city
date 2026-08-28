import type {
  Cell,
  LandUnlockPreviewStatus,
  TownDetail,
  UnlockedArea,
} from '../types'

export const LAND_UNLOCK_ITEM_CODE = 'unlock-area'
export const LAND_UNLOCK_BLOCK_SIZE = 20
export const LAND_UNLOCK_COST_COINS = 1_000

export function getLandUnlockAreaForCell(cell: Cell): UnlockedArea {
  return {
    x: Math.floor(cell.x / LAND_UNLOCK_BLOCK_SIZE) * LAND_UNLOCK_BLOCK_SIZE,
    y: Math.floor(cell.y / LAND_UNLOCK_BLOCK_SIZE) * LAND_UNLOCK_BLOCK_SIZE,
    width: LAND_UNLOCK_BLOCK_SIZE,
    height: LAND_UNLOCK_BLOCK_SIZE,
  }
}

export function isLandUnlockAreaAligned(area: UnlockedArea): boolean {
  return (
    Number.isInteger(area.x) &&
    Number.isInteger(area.y) &&
    area.x % LAND_UNLOCK_BLOCK_SIZE === 0 &&
    area.y % LAND_UNLOCK_BLOCK_SIZE === 0 &&
    area.width === LAND_UNLOCK_BLOCK_SIZE &&
    area.height === LAND_UNLOCK_BLOCK_SIZE
  )
}

export function isLandUnlockAreaWithinMap(
  area: UnlockedArea,
  mapWidth: number,
  mapHeight: number,
): boolean {
  return (
    isLandUnlockAreaAligned(area) &&
    area.x >= 0 &&
    area.y >= 0 &&
    area.x + area.width <= mapWidth &&
    area.y + area.height <= mapHeight
  )
}

export function isLandUnlockAreaAlreadyUnlocked(
  area: UnlockedArea,
  unlockedAreas: UnlockedArea[],
): boolean {
  return unlockedAreas.some(
    (unlockedArea) =>
      area.x >= unlockedArea.x &&
      area.y >= unlockedArea.y &&
      area.x + area.width <= unlockedArea.x + unlockedArea.width &&
      area.y + area.height <= unlockedArea.y + unlockedArea.height,
  )
}

export function isLandUnlockAreaAdjacent(
  area: UnlockedArea,
  unlockedAreas: UnlockedArea[],
): boolean {
  return unlockedAreas.some((unlockedArea) => {
    const directlyAboveOrBelow =
      area.x === unlockedArea.x &&
      area.width === unlockedArea.width &&
      (area.y + area.height === unlockedArea.y ||
        unlockedArea.y + unlockedArea.height === area.y)
    const directlyLeftOrRight =
      area.y === unlockedArea.y &&
      area.height === unlockedArea.height &&
      (area.x + area.width === unlockedArea.x ||
        unlockedArea.x + unlockedArea.width === area.x)

    return directlyAboveOrBelow || directlyLeftOrRight
  })
}

export function evaluateLandUnlockPreview(input: {
  town: TownDetail
  area: UnlockedArea
  costCoins?: number
}): LandUnlockPreviewStatus {
  const costCoins = input.costCoins ?? LAND_UNLOCK_COST_COINS

  if (
    !isLandUnlockAreaWithinMap(
      input.area,
      input.town.town.mapWidth,
      input.town.town.mapHeight,
    )
  ) {
    return { status: 'invalid', reason: 'OUT_OF_MAP' }
  }

  if (
    isLandUnlockAreaAlreadyUnlocked(input.area, input.town.unlockedAreas)
  ) {
    return { status: 'invalid', reason: 'AREA_ALREADY_UNLOCKED' }
  }

  if (!isLandUnlockAreaAdjacent(input.area, input.town.unlockedAreas)) {
    return { status: 'invalid', reason: 'AREA_NOT_ADJACENT' }
  }

  const coins = input.town.town.coins
  if (coins === undefined || coins < costCoins) {
    return { status: 'invalid', reason: 'INSUFFICIENT_COINS' }
  }

  return { status: 'valid' }
}
