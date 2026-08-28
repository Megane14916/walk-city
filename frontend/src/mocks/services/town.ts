import type { TownApi } from '../../features/town/api'
import type {
  BuildingCatalogItem,
  MoveBuildingInput,
  PlaceBuildingInput,
  PlaceRoadLineInput,
  PlaceRoadLineResult,
  PlacedBuilding,
  RenameBuildingResult,
  TownDetail,
  TownMutationResult,
  UnlockLandInput,
  UnlockLandResult,
} from '../../features/town/types'
import {
  evaluateLandUnlockPreview,
  evaluateRoadLinePreview,
  areCellsUnlocked,
  areCellsWithinMap,
  createOccupiedCellIndex,
  createRoadCellIndex,
  getOccupiedCells,
  hasAdjacentRoad,
  hasCollision,
  LAND_UNLOCK_BLOCK_SIZE,
  LAND_UNLOCK_COST_COINS,
  isStraightRoadLine,
} from '../../features/town/utils'
import type {
  ApiErrorCode,
  ApiResult,
} from '../../types/common'
import {
  MOCK_BUILDING_CATALOG,
  MOCK_MY_TOWN,
  MOCK_PUBLIC_TOWNS,
} from '../data/towns'
import {
  createMockWalkCityStore,
  mockWalkCityStore,
  type MockWalkCityStore,
} from './walk-city-store'

export type MockTownOperation =
  | 'getBuildingCatalog'
  | 'getMyTown'
  | 'getPublicTown'
  | 'placeBuilding'
  | 'placeRoadLine'
  | 'moveBuilding'
  | 'renameBuilding'
  | 'unlockLand'

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
  | 'AREA_ALREADY_UNLOCKED'
  | 'AREA_NOT_ADJACENT'
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
  store?: MockWalkCityStore
}

export type MockTownApi = TownApi & {
  setFailure(
    operation: MockTownOperation,
    code: TownMockErrorCode | null,
  ): void
  setException(operation: MockTownOperation, enabled: boolean): void
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
  AREA_ALREADY_UNLOCKED: 'この区画はすでに開放されています。',
  AREA_NOT_ADJACENT: '開放済み区画の上下左右を選んでください。',
  NOT_OWNER: 'この街は編集できません。',
  NOT_FOUND: '対象が見つかりません。',
  CONFLICT: '街の状態が更新されました。再読み込みしてください。',
  INTERNAL_ERROR: '予期しないエラーが発生しました。',
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)
  })
}

function normalizeBuildingName(value: string): string | null {
  const normalized = value.trim()
  if (
    normalized.length === 0 ||
    Array.from(normalized).length > 30 ||
    hasControlCharacter(normalized)
  ) {
    return null
  }
  return normalized
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

function sameRoadLineInput(
  left: PlaceRoadLineInput,
  right: PlaceRoadLineInput,
): boolean {
  return (
    left.buildingTypeCode === right.buildingTypeCode &&
    left.cells.length === right.cells.length &&
    left.cells.every(
      (cell, index) =>
        cell.x === right.cells[index].x && cell.y === right.cells[index].y,
    )
  )
}

function sameUnlockInput(
  left: UnlockLandInput,
  right: UnlockLandInput,
): boolean {
  return left.x === right.x && left.y === right.y
}

export function createMockTownApi(
  options: MockTownApiOptions = {},
): MockTownApi {
  const latencyMs = options.latencyMs ?? 150
  const now = options.now ?? (() => new Date())
  const initialTown = copyTown(options.initialTown ?? MOCK_MY_TOWN)
  const store =
    options.store ?? createMockWalkCityStore({ initialTown })
  const initialCatalog = (options.catalog ?? MOCK_BUILDING_CATALOG).map(
    copyCatalogItem,
  )
  const initialPublicTowns = {
    ...MOCK_PUBLIC_TOWNS,
    ...options.publicTowns,
  }
  const failures = new Map<MockTownOperation, TownMockErrorCode>()
  const exceptions = new Set<MockTownOperation>()
  const placeResults = new Map<
    string,
    { input: PlaceBuildingInput; result: TownMutationResult }
  >()
  const moveResults = new Map<
    string,
    { input: MoveBuildingInput; result: TownMutationResult }
  >()
  const roadLineResults = new Map<
    string,
    { input: PlaceRoadLineInput; result: PlaceRoadLineResult }
  >()
  const unlockResults = new Map<
    string,
    { input: UnlockLandInput; result: UnlockLandResult }
  >()

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

  const throwConfiguredException = (operation: MockTownOperation): void => {
    if (exceptions.has(operation)) {
      throw new Error(`Mock ${operation} exception`)
    }
  }

  return {
    async getBuildingCatalog() {
      await wait()
      throwConfiguredException('getBuildingCatalog')
      return (
        configuredFailure('getBuildingCatalog') ??
        success(catalog.map(copyCatalogItem))
      )
    },

    async getMyTown() {
      await wait()
      throwConfiguredException('getMyTown')
      return (
        configuredFailure('getMyTown') ??
        success(copyTown(store.getMutableTown()))
      )
    },

    async getPublicTown(userId) {
      await wait()
      throwConfiguredException('getPublicTown')
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
      throwConfiguredException('placeBuilding')
      const failed = configuredFailure<TownMutationResult>('placeBuilding')
      if (failed) return failed
      if (input.requestId.trim() === '') return failure('INVALID_INPUT')
      const town = store.getMutableTown()

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
        customName: null,
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

    async placeRoadLine(input) {
      await wait()
      const failed = configuredFailure<PlaceRoadLineResult>('placeRoadLine')
      if (failed) return failed
      if (
        input.requestId.trim() === '' ||
        !isStraightRoadLine(input.cells)
      ) {
        return failure('INVALID_INPUT')
      }
      const town = store.getMutableTown()

      const previous = roadLineResults.get(input.requestId)
      if (previous) {
        return sameRoadLineInput(previous.input, input)
          ? success({
              ...previous.result,
              buildings: previous.result.buildings.map((building) => ({
                ...building,
              })),
            })
          : failure('CONFLICT')
      }

      const item = catalog.find(
        (candidate) => candidate.code === input.buildingTypeCode,
      )
      if (!item) return failure('NOT_FOUND')
      if (item.category !== 'road' || item.width !== 1 || item.height !== 1) {
        return failure('INVALID_INPUT')
      }

      const preview = evaluateRoadLinePreview({
        town,
        catalog,
        item,
        cells: input.cells,
      })
      if (preview.status.status === 'unknown') return failure('NOT_OWNER')
      if (preview.status.status === 'invalid') {
        return failure(
          preview.status.reason === 'NO_NEW_ROAD_CELLS'
            ? 'CELL_OCCUPIED'
            : preview.status.reason,
        )
      }

      const timestamp = now().toISOString()
      const buildings = preview.newCells.map((cell) => {
        const building: PlacedBuilding = {
          id: `mock-building-${String(nextBuildingNumber).padStart(3, '0')}`,
          buildingTypeCode: item.code,
          customName: null,
          anchorX: cell.x,
          anchorY: cell.y,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        nextBuildingNumber += 1
        return building
      })

      town.buildings.push(...buildings)
      town.town.coins = (town.town.coins ?? 0) - preview.totalCostCoins

      const result: PlaceRoadLineResult = {
        buildings: buildings.map((building) => ({ ...building })),
        coinBalance: town.town.coins,
        population: town.town.population,
        updatedAt: timestamp,
      }
      roadLineResults.set(input.requestId, {
        input: {
          ...input,
          cells: input.cells.map((cell) => ({ ...cell })),
        },
        result: {
          ...result,
          buildings: result.buildings.map((building) => ({ ...building })),
        },
      })

      return success(result)
    },

    async moveBuilding(input) {
      await wait()
      throwConfiguredException('moveBuilding')
      const failed = configuredFailure<TownMutationResult>('moveBuilding')
      if (failed) return failed
      if (input.requestId.trim() === '') return failure('INVALID_INPUT')
      const town = store.getMutableTown()

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

    async renameBuilding(input) {
      await wait()
      const failed = configuredFailure<RenameBuildingResult>('renameBuilding')
      if (failed) return failed
      if (input.buildingId.trim() === '') return failure('INVALID_INPUT')

      const town = store.getMutableTown()
      if (town.editable !== true) return failure('NOT_OWNER')
      const building = town.buildings.find(
        (candidate) => candidate.id === input.buildingId,
      )
      if (!building) return failure('NOT_FOUND')

      const item = catalogItemFor(catalog, building)
      if (!item) return failure('NOT_FOUND')
      let customName: string | null = null
      if (input.customName !== null) {
        const normalized = normalizeBuildingName(input.customName)
        if (normalized === null) {
          return {
            ok: false,
            error: {
              code: 'INVALID_INPUT',
              message: '表示名は1〜30文字で入力してください。',
            },
          }
        }
        customName = normalized === item.name ? null : normalized
      }

      const timestamp = now().toISOString()
      building.customName = customName
      building.updatedAt = timestamp

      return success({
        building: { ...building },
        updatedAt: timestamp,
      })
    },

    async unlockLand(input) {
      await wait()
      const failed = configuredFailure<UnlockLandResult>('unlockLand')
      if (failed) return failed
      if (
        input.requestId.trim() === '' ||
        !Number.isInteger(input.x) ||
        !Number.isInteger(input.y) ||
        input.x % LAND_UNLOCK_BLOCK_SIZE !== 0 ||
        input.y % LAND_UNLOCK_BLOCK_SIZE !== 0
      ) {
        return failure('INVALID_INPUT')
      }
      const town = store.getMutableTown()

      const previous = unlockResults.get(input.requestId)
      if (previous) {
        return sameUnlockInput(previous.input, input)
          ? success({
              ...previous.result,
              unlockedArea: { ...previous.result.unlockedArea },
            })
          : failure('CONFLICT')
      }

      const coinBalance = town.town.coins
      if (coinBalance === undefined) return failure('NOT_OWNER')

      const unlockedArea = {
        x: input.x,
        y: input.y,
        width: LAND_UNLOCK_BLOCK_SIZE,
        height: LAND_UNLOCK_BLOCK_SIZE,
      }
      const preview = evaluateLandUnlockPreview({ town, area: unlockedArea })
      if (preview.status === 'invalid') return failure(preview.reason)

      const timestamp = now().toISOString()
      town.town.coins = coinBalance - LAND_UNLOCK_COST_COINS
      town.unlockedAreas.push(unlockedArea)

      const result: UnlockLandResult = {
        unlockedArea: { ...unlockedArea },
        coinBalance: town.town.coins,
        updatedAt: timestamp,
      }
      unlockResults.set(input.requestId, {
        input: { ...input },
        result: { ...result, unlockedArea: { ...result.unlockedArea } },
      })

      return success(result)
    },

    setFailure(operation, code) {
      if (code) failures.set(operation, code)
      else failures.delete(operation)
    },

    setException(operation, enabled) {
      if (enabled) exceptions.add(operation)
      else exceptions.delete(operation)
    },

    getTownSnapshot() {
      return copyTown(store.getMutableTown())
    },

    reset() {
      failures.clear()
      exceptions.clear()
      placeResults.clear()
      roadLineResults.clear()
      moveResults.clear()
      unlockResults.clear()
      store.reset()
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

export const mockTownApi = createMockTownApi({ store: mockWalkCityStore })
