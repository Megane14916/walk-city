import type { TownApi } from '../../features/town/api'
import type {
  BuildingCatalogItem,
  MoveBuildingInput,
  PlaceBuildingInput,
  PlacedBuilding,
  TownDetail,
  TownMutationResult,
} from '../../features/town/types'
import {
  areCellsUnlocked,
  areCellsWithinMap,
  createOccupiedCellIndex,
  createRoadCellIndex,
  getOccupiedCells,
  hasAdjacentRoad,
  hasCollision,
} from '../../features/town/utils'
import type {
  ApiErrorCode,
  ApiResult,
} from '../../types/common'
import {
  MOCK_BUILDING_CATALOG,
  MOCK_MY_TOWN,
  MOCK_PUBLIC_TOWN,
  MOCK_PUBLIC_USER_ID,
} from '../data/towns'

export type MockTownOperation =
  | 'getBuildingCatalog'
  | 'getMyTown'
  | 'getPublicTown'
  | 'placeBuilding'
  | 'moveBuilding'

export type TownMockErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'CATALOG_ITEM_DISABLED'
  | 'PRICE_NOT_SET'
  | 'INSUFFICIENT_COINS'
  | 'OUT_OF_MAP'
  | 'LAND_LOCKED'
  | 'CELL_OCCUPIED'
  | 'ROAD_REQUIRED'
  | 'NOT_OWNER'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

export type MockTownApiOptions = {
  latencyMs?: number
  now?: () => Date
  initialTown?: TownDetail
  catalog?: BuildingCatalogItem[]
  publicTowns?: Record<string, TownDetail>
}

export type MockTownApi = TownApi & {
  setFailure(
    operation: MockTownOperation,
    code: TownMockErrorCode | null,
  ): void
  getTownSnapshot(): TownDetail
  reset(): void
}

const errorMessages: Record<TownMockErrorCode, string> = {
  UNAUTHENTICATED: 'ログインしてください。',
  INVALID_INPUT: '入力内容が正しくありません。',
  CATALOG_ITEM_DISABLED: 'この建物は現在購入できません。',
  PRICE_NOT_SET: 'この建物は価格の準備中です。',
  INSUFFICIENT_COINS: 'コインが不足しています。',
  OUT_OF_MAP: 'マップ内の位置を選んでください。',
  LAND_LOCKED: '開放済みの土地を選んでください。',
  CELL_OCCUPIED: '他の建物または障害物と重なっています。',
  ROAD_REQUIRED: '建物は道路に隣接する必要があります。',
  NOT_OWNER: 'この街は編集できません。',
  NOT_FOUND: '対象が見つかりません。',
  CONFLICT: '街の状態が更新されました。再読み込みしてください。',
  INTERNAL_ERROR: '予期しないエラーが発生しました。',
}

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function failure<T>(code: TownMockErrorCode): ApiResult<T> {
  return {
    ok: false,
    error: {
      code: code satisfies ApiErrorCode,
      message: errorMessages[code],
    },
  }
}

function copyCatalogItem(item: BuildingCatalogItem): BuildingCatalogItem {
  return {
    ...item,
    effects: item.effects.map((effect) => ({
      ...effect,
      metadata: { ...effect.metadata },
    })),
  }
}

function copyTown(town: TownDetail): TownDetail {
  return {
    town: {
      ...town.town,
      owner: { ...town.town.owner },
    },
    buildings: town.buildings.map((building) => ({ ...building })),
    unlockedAreas: town.unlockedAreas.map((area) => ({ ...area })),
    obstacles: town.obstacles.map((obstacle) => ({ ...obstacle })),
    catalogVersion: town.catalogVersion,
    editable: town.editable,
  }
}

function catalogItemFor(
  catalog: BuildingCatalogItem[],
  building: PlacedBuilding,
): BuildingCatalogItem | undefined {
  return catalog.find((item) => item.code === building.buildingTypeCode)
}

function placementError(
  town: TownDetail,
  catalog: BuildingCatalogItem[],
  item: BuildingCatalogItem,
  anchorX: number,
  anchorY: number,
  excludedBuildingId?: string,
): TownMockErrorCode | null {
  if (!Number.isInteger(anchorX) || !Number.isInteger(anchorY)) {
    return 'INVALID_INPUT'
  }

  const cells = getOccupiedCells(
    { x: anchorX, y: anchorY },
    item.width,
    item.height,
  )

  if (!areCellsWithinMap(cells, town.town.mapWidth, town.town.mapHeight)) {
    return 'OUT_OF_MAP'
  }

  if (!areCellsUnlocked(cells, town.unlockedAreas)) {
    return 'LAND_LOCKED'
  }

  const occupied = createOccupiedCellIndex(
    town.buildings,
    catalog,
    town.obstacles,
    excludedBuildingId,
  )
  if (hasCollision(cells, occupied)) {
    return 'CELL_OCCUPIED'
  }

  if (
    item.category !== 'road' &&
    !hasAdjacentRoad(
      cells,
      createRoadCellIndex(town.buildings, catalog, excludedBuildingId),
    )
  ) {
    return 'ROAD_REQUIRED'
  }

  return null
}

function populationIncrease(item: BuildingCatalogItem): number {
  return item.effects.reduce((total, effect) => {
    if (effect.type !== 'population_flat' || effect.value === null) {
      return total
    }
    return total + effect.value
  }, 0)
}

function samePlaceInput(
  left: PlaceBuildingInput,
  right: PlaceBuildingInput,
): boolean {
  return (
    left.buildingTypeCode === right.buildingTypeCode &&
    left.anchorX === right.anchorX &&
    left.anchorY === right.anchorY
  )
}

function sameMoveInput(
  left: MoveBuildingInput,
  right: MoveBuildingInput,
): boolean {
  return (
    left.buildingId === right.buildingId &&
    left.anchorX === right.anchorX &&
    left.anchorY === right.anchorY
  )
}

export function createMockTownApi(
  options: MockTownApiOptions = {},
): MockTownApi {
  const latencyMs = options.latencyMs ?? 150
  const now = options.now ?? (() => new Date())
  const initialTown = copyTown(options.initialTown ?? MOCK_MY_TOWN)
  const initialCatalog = (options.catalog ?? MOCK_BUILDING_CATALOG).map(
    copyCatalogItem,
  )
  const initialPublicTowns = {
    [MOCK_PUBLIC_USER_ID]: MOCK_PUBLIC_TOWN,
    ...options.publicTowns,
  }
  const failures = new Map<MockTownOperation, TownMockErrorCode>()
  const placeResults = new Map<
    string,
    { input: PlaceBuildingInput; result: TownMutationResult }
  >()
  const moveResults = new Map<
    string,
    { input: MoveBuildingInput; result: TownMutationResult }
  >()

  let town = copyTown(initialTown)
  let catalog = initialCatalog.map(copyCatalogItem)
  let publicTowns = Object.fromEntries(
    Object.entries(initialPublicTowns).map(([userId, publicTown]) => [
      userId,
      copyTown(publicTown),
    ]),
  )
  let nextBuildingNumber = 1

  const wait = async () => {
    if (latencyMs <= 0) return
    await new Promise<void>((resolve) =>
      globalThis.setTimeout(resolve, latencyMs),
    )
  }

  const configuredFailure = <T>(
    operation: MockTownOperation,
  ): ApiResult<T> | null => {
    const code = failures.get(operation)
    return code ? failure<T>(code) : null
  }

  return {
    async getBuildingCatalog() {
      await wait()
      return (
        configuredFailure('getBuildingCatalog') ??
        success(catalog.map(copyCatalogItem))
      )
    },

    async getMyTown() {
      await wait()
      return configuredFailure('getMyTown') ?? success(copyTown(town))
    },

    async getPublicTown(userId) {
      await wait()
      const failed = configuredFailure<TownDetail>('getPublicTown')
      if (failed) return failed
      if (userId.trim() === '') return failure('INVALID_INPUT')

      const publicTown = publicTowns[userId]
      return publicTown
        ? success(copyTown(publicTown))
        : failure('NOT_FOUND')
    },

    async placeBuilding(input) {
      await wait()
      const failed = configuredFailure<TownMutationResult>('placeBuilding')
      if (failed) return failed
      if (input.requestId.trim() === '') return failure('INVALID_INPUT')

      const previous = placeResults.get(input.requestId)
      if (previous) {
        return samePlaceInput(previous.input, input)
          ? success({ ...previous.result, building: { ...previous.result.building } })
          : failure('CONFLICT')
      }

      const item = catalog.find(
        (candidate) => candidate.code === input.buildingTypeCode,
      )
      if (!item) return failure('NOT_FOUND')
      if (!item.enabled) return failure('CATALOG_ITEM_DISABLED')
      if (item.costCoins === null) return failure('PRICE_NOT_SET')

      const coinBalance = town.town.coins
      if (coinBalance === undefined) return failure('NOT_OWNER')
      if (coinBalance < item.costCoins) return failure('INSUFFICIENT_COINS')

      const invalidReason = placementError(
        town,
        catalog,
        item,
        input.anchorX,
        input.anchorY,
      )
      if (invalidReason) return failure(invalidReason)

      const timestamp = now().toISOString()
      const building: PlacedBuilding = {
        id: `mock-building-${String(nextBuildingNumber).padStart(3, '0')}`,
        buildingTypeCode: item.code,
        anchorX: input.anchorX,
        anchorY: input.anchorY,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      nextBuildingNumber += 1

      town.buildings.push(building)
      town.town.coins = coinBalance - item.costCoins
      town.town.population += populationIncrease(item)

      const result: TownMutationResult = {
        building: { ...building },
        coinBalance: town.town.coins,
        population: town.town.population,
        updatedAt: timestamp,
      }
      placeResults.set(input.requestId, {
        input: { ...input },
        result: { ...result, building: { ...result.building } },
      })

      return success(result)
    },

    async moveBuilding(input) {
      await wait()
      const failed = configuredFailure<TownMutationResult>('moveBuilding')
      if (failed) return failed
      if (input.requestId.trim() === '') return failure('INVALID_INPUT')

      const previous = moveResults.get(input.requestId)
      if (previous) {
        return sameMoveInput(previous.input, input)
          ? success({ ...previous.result, building: { ...previous.result.building } })
          : failure('CONFLICT')
      }

      const building = town.buildings.find(
        (candidate) => candidate.id === input.buildingId,
      )
      if (!building) return failure('NOT_FOUND')
      if (building.anchorX === input.anchorX && building.anchorY === input.anchorY) {
        return failure('INVALID_INPUT')
      }

      const item = catalogItemFor(catalog, building)
      if (!item) return failure('NOT_FOUND')

      const invalidReason = placementError(
        town,
        catalog,
        item,
        input.anchorX,
        input.anchorY,
        building.id,
      )
      if (invalidReason) return failure(invalidReason)

      const timestamp = now().toISOString()
      building.anchorX = input.anchorX
      building.anchorY = input.anchorY
      building.updatedAt = timestamp

      const result: TownMutationResult = {
        building: { ...building },
        coinBalance: town.town.coins ?? 0,
        population: town.town.population,
        updatedAt: timestamp,
      }
      moveResults.set(input.requestId, {
        input: { ...input },
        result: { ...result, building: { ...result.building } },
      })

      return success(result)
    },

    setFailure(operation, code) {
      if (code) failures.set(operation, code)
      else failures.delete(operation)
    },

    getTownSnapshot() {
      return copyTown(town)
    },

    reset() {
      failures.clear()
      placeResults.clear()
      moveResults.clear()
      town = copyTown(initialTown)
      catalog = initialCatalog.map(copyCatalogItem)
      publicTowns = Object.fromEntries(
        Object.entries(initialPublicTowns).map(([userId, publicTown]) => [
          userId,
          copyTown(publicTown),
        ]),
      )
      nextBuildingNumber = 1
    },
  }
}

export const mockTownApi = createMockTownApi()
