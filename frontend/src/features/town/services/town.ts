import type { SupabaseClient } from '@supabase/supabase-js'
import {
  parseApiResultEnvelope,
  supabaseFailure,
} from '../../../lib/supabase-api'
import type { ApiErrorCode, ApiResult } from '../../../types/common'
import type { TownApi } from '../api'
import { FIXED_MAP_LAYOUT } from '../data/map-layout'
import type {
  BuildingCatalogItem,
  BuildingEffect,
  DeleteRoadResult,
  PlaceRoadLineResult,
  RenameBuildingResult,
  TownDetail,
  TownMutationResult,
  UnlockLandResult,
} from '../types'
import { isBuildingCatalog, isTownDetail } from './town-contract'

export type SupabaseTownViewNames = {
  buildingCatalog: string
  myTownDetails: string
  publicTownDetails: string
}

export type SupabaseTownRpcNames = {
  placeBuilding: string
  moveBuilding: string
  placeRoadLine: string
  deleteRoad: string
  unlockLand: string
  renameBuilding: string
}

export type SupabaseTownApiOptions = {
  viewNames?: Partial<SupabaseTownViewNames>
  rpcNames?: Partial<SupabaseTownRpcNames>
}

const DEFAULT_VIEW_NAMES: SupabaseTownViewNames = {
  buildingCatalog: 'building_catalog_view',
  myTownDetails: 'my_town_details_view',
  publicTownDetails: 'public_town_details_view',
}

const DEFAULT_RPC_NAMES: SupabaseTownRpcNames = {
  placeBuilding: 'place_building',
  moveBuilding: 'move_building',
  placeRoadLine: 'place_road_line',
  deleteRoad: 'delete_road',
  unlockLand: 'unlock_land',
  renameBuilding: 'rename_building',
}

const CATALOG_COLUMNS = [
  'code',
  'name',
  'category',
  'width',
  'height',
  'cost_coins',
  'enabled',
  'description',
  'catalog_version',
  'effects',
].join(',')

const MY_TOWN_COLUMNS = [
  'town_id',
  'owner_id',
  'display_name',
  'town_name',
  'coins',
  'population',
  'map_width',
  'map_height',
  'buildings',
  'unlocked_areas',
  'catalog_version',
].join(',')

const PUBLIC_TOWN_COLUMNS = [
  'town_id',
  'owner_id',
  'display_name',
  'town_name',
  'population',
  'map_width',
  'map_height',
  'buildings',
  'unlocked_areas',
  'catalog_version',
].join(',')

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
}

function toSafeInteger(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : undefined
  }
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return undefined

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value !== 'string' || value.trim() === '') return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null
  return typeof value === 'string' ? value : undefined
}

function effectDescription(type: string, value: number | null): string {
  if (type === 'population_flat' && value !== null) {
    return `人口を${value}増やします`
  }
  if (type === 'step_coin_bonus_percent' && value !== null) {
    return `歩数同期時の獲得コインを${value}%増やします`
  }
  if (type === 'adjacent_small_house_population_flat' && value !== null) {
    return `上下左右に隣接する住宅（小）1軒につき人口を${value}増やします`
  }
  if (type === 'adjacent_apartment_population_flat' && value !== null) {
    return `上下左右に隣接する住宅（大）1軒につき人口を${value}増やします`
  }
  if (type === 'small_house_population_flat' && value !== null) {
    return `町内の住宅（小）1軒につき人口を${value}増やします`
  }
  if (type === 'apartment_population_flat' && value !== null) {
    return `町内の住宅（大）1軒につき人口を${value}増やします`
  }
  return ''
}

function mapEffect(value: unknown): BuildingEffect | null {
  if (!isRecord(value) || !isNonEmptyString(value.effect_type)) return null

  const effectValue =
    value.value === null ? null : toFiniteNumber(value.value)
  const targetCategory = nullableString(value.target_category)
  const scope = nullableString(value.scope)
  const stackingRule = nullableString(value.stacking_rule)
  if (
    effectValue === undefined ||
    targetCategory === undefined ||
    scope === undefined ||
    stackingRule === undefined ||
    !isRecord(value.metadata)
  ) {
    return null
  }

  return {
    type: value.effect_type,
    value: effectValue,
    targetCategory,
    scope,
    stackingRule,
    description: effectDescription(value.effect_type, effectValue),
    metadata: value.metadata,
  }
}

function mapCatalogItem(value: unknown): BuildingCatalogItem | null {
  if (!isRecord(value)) return null

  const width = toSafeInteger(value.width)
  const height = toSafeInteger(value.height)
  const costCoins =
    value.cost_coins === null ? null : toSafeInteger(value.cost_coins)
  const catalogVersion = toSafeInteger(value.catalog_version)
  if (
    !isNonEmptyString(value.code) ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyString(value.category) ||
    (width !== 1 && width !== 2) ||
    (height !== 1 && height !== 2) ||
    costCoins === undefined ||
    (costCoins !== null && costCoins < 0) ||
    typeof value.enabled !== 'boolean' ||
    typeof value.description !== 'string' ||
    catalogVersion === undefined ||
    catalogVersion < 0 ||
    !Array.isArray(value.effects)
  ) {
    return null
  }

  const effects = value.effects.map(mapEffect)
  if (effects.some((effect) => effect === null)) return null

  return {
    code: value.code,
    name: value.name,
    category: value.category,
    width,
    height,
    costCoins,
    enabled: value.enabled,
    description: value.description,
    effects: effects as BuildingEffect[],
    assetKey: value.code,
    catalogVersion,
  }
}

function mapPlacedBuilding(value: unknown): TownDetail['buildings'][number] | null {
  if (!isRecord(value)) return null

  const buildingTypeCode = value.building_type_code ?? value.buildingTypeCode
  const customName = nullableString(value.custom_name ?? value.customName ?? null)
  const anchorX = toSafeInteger(value.anchor_x ?? value.anchorX)
  const anchorY = toSafeInteger(value.anchor_y ?? value.anchorY)
  const roadStructureId = nullableString(
    value.road_structure_id ?? value.roadStructureId ?? null,
  )
  const rawRoadVariant = value.road_variant ?? value.roadVariant
  const roadVariant =
    rawRoadVariant === undefined && buildingTypeCode === 'road'
      ? 'normal'
      : rawRoadVariant ?? null
  const createdAt = value.created_at ?? value.createdAt
  const updatedAt = value.updated_at ?? value.updatedAt
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(buildingTypeCode) ||
    customName === undefined ||
    anchorX === undefined ||
    anchorX < 0 ||
    anchorY === undefined ||
    anchorY < 0 ||
    roadStructureId === undefined ||
    !(
      roadVariant === null ||
      roadVariant === 'normal' ||
      roadVariant === 'bridge_horizontal' ||
      roadVariant === 'bridge_vertical'
    ) ||
    !isNonEmptyString(createdAt) ||
    !isNonEmptyString(updatedAt)
  ) {
    return null
  }

  return {
    id: value.id,
    buildingTypeCode,
    customName,
    anchorX,
    anchorY,
    roadStructureId,
    roadVariant,
    createdAt,
    updatedAt,
  }
}

function unwrapRpcData(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value
}

function mapTownMutationResult(value: unknown): TownMutationResult | null {
  const data = unwrapRpcData(value)
  if (!isRecord(data)) return null

  const building = mapPlacedBuilding(data.building)
  const coinBalance = toSafeInteger(data.coin_balance ?? data.coinBalance)
  const population = toSafeInteger(data.population)
  const updatedAt = data.updated_at ?? data.updatedAt
  if (
    building === null ||
    coinBalance === undefined ||
    coinBalance < 0 ||
    population === undefined ||
    population < 0 ||
    !isNonEmptyString(updatedAt)
  ) {
    return null
  }

  return {
    building,
    coinBalance,
    population,
    updatedAt,
  }
}

function mapPlaceRoadLineResult(value: unknown): PlaceRoadLineResult | null {
  const data = unwrapRpcData(value)
  if (!isRecord(data) || !Array.isArray(data.buildings)) return null

  const buildings = data.buildings.map(mapPlacedBuilding)
  const placementKind = data.placement_kind ?? data.placementKind ?? 'road'
  const roadStructureId = nullableString(
    data.road_structure_id ?? data.roadStructureId ?? null,
  )
  const totalCostCoins = toSafeInteger(
    data.total_cost_coins ?? data.totalCostCoins ?? 0,
  )
  const coinBalance = toSafeInteger(data.coin_balance ?? data.coinBalance)
  const population = toSafeInteger(data.population)
  const updatedAt = data.updated_at ?? data.updatedAt
  if (
    buildings.some((building) => building === null) ||
    (placementKind !== 'road' && placementKind !== 'bridge') ||
    roadStructureId === undefined ||
    totalCostCoins === undefined ||
    totalCostCoins < 0 ||
    coinBalance === undefined ||
    coinBalance < 0 ||
    population === undefined ||
    population < 0 ||
    !isNonEmptyString(updatedAt)
  ) {
    return null
  }

  return {
    buildings: buildings as PlaceRoadLineResult['buildings'],
    placementKind,
    roadStructureId,
    totalCostCoins,
    coinBalance,
    population,
    updatedAt,
  }
}

function mapDeleteRoadResult(value: unknown): DeleteRoadResult | null {
  const data = unwrapRpcData(value)
  if (!isRecord(data) || !Array.isArray(data.deletedBuildingIds ?? data.deleted_building_ids)) {
    return null
  }

  const deletionKind = data.deletion_kind ?? data.deletionKind
  const deletedBuildingIds = data.deleted_building_ids ?? data.deletedBuildingIds
  const deletedRoadStructureId = nullableString(
    data.deleted_road_structure_id ?? data.deletedRoadStructureId ?? null,
  )
  const coinBalance = toSafeInteger(data.coin_balance ?? data.coinBalance)
  const population = toSafeInteger(data.population)
  const updatedAt = data.updated_at ?? data.updatedAt
  if (
    (deletionKind !== 'road' && deletionKind !== 'bridge') ||
    !Array.isArray(deletedBuildingIds) ||
    deletedBuildingIds.length === 0 ||
    deletedBuildingIds.some((id) => !isNonEmptyString(id)) ||
    deletedRoadStructureId === undefined ||
    coinBalance === undefined ||
    coinBalance < 0 ||
    population === undefined ||
    population < 0 ||
    !isNonEmptyString(updatedAt)
  ) {
    return null
  }

  return {
    deletionKind,
    deletedBuildingIds: deletedBuildingIds as string[],
    deletedRoadStructureId,
    coinBalance,
    population,
    updatedAt,
  }
}

function mapUnlockLandResult(value: unknown): UnlockLandResult | null {
  const data = unwrapRpcData(value)
  if (!isRecord(data)) return null

  const unlockedArea = mapUnlockedArea(data.unlocked_area)
  const coinBalance = toSafeInteger(data.coin_balance)
  if (
    unlockedArea === null ||
    coinBalance === undefined ||
    coinBalance < 0 ||
    !isNonEmptyString(data.updated_at)
  ) {
    return null
  }

  return { unlockedArea, coinBalance, updatedAt: data.updated_at }
}

function mapRenameBuildingResult(value: unknown): RenameBuildingResult | null {
  const data = unwrapRpcData(value)
  if (!isRecord(data)) return null

  const building = mapPlacedBuilding(data.building)
  const updatedAt = data.updated_at ?? data.updatedAt
  if (building === null || !isNonEmptyString(updatedAt)) return null

  return { building, updatedAt }
}

function parseRpcResult<T>(
  value: unknown,
  mapper: (data: unknown) => T | null,
  fallbackMessage: string,
): ApiResult<T> {
  const envelope = parseApiResultEnvelope(
    value,
    (data): data is unknown => mapper(data) !== null,
    fallbackMessage,
  )
  if (!envelope.ok) return envelope

  return { ok: true, data: mapper(envelope.data) as T }
}

function mapUnlockedArea(value: unknown): TownDetail['unlockedAreas'][number] | null {
  if (!isRecord(value)) return null

  const x = toSafeInteger(value.x)
  const y = toSafeInteger(value.y)
  const width = toSafeInteger(value.width)
  const height = toSafeInteger(value.height)
  if (
    x === undefined ||
    x < 0 ||
    y === undefined ||
    y < 0 ||
    width === undefined ||
    width <= 0 ||
    height === undefined ||
    height <= 0
  ) {
    return null
  }

  return { x, y, width, height }
}

const PRIVATE_PUBLIC_TOWN_FIELDS = [
  'coins',
  'coin_ledger',
  'email',
  'daily_step_records',
  'health_connections',
] as const

function mapTownDetail(value: unknown, editable: boolean): TownDetail | null {
  if (!isRecord(value)) return null
  if (
    !editable &&
    PRIVATE_PUBLIC_TOWN_FIELDS.some((field) => field in value)
  ) {
    return null
  }

  const coins = editable ? toSafeInteger(value.coins) : undefined
  const population = toSafeInteger(value.population)
  const mapWidth = toSafeInteger(value.map_width)
  const mapHeight = toSafeInteger(value.map_height)
  const catalogVersion = toSafeInteger(value.catalog_version)
  if (
    !isNonEmptyString(value.town_id) ||
    !isNonEmptyString(value.owner_id) ||
    !isNonEmptyString(value.display_name) ||
    !isNonEmptyString(value.town_name) ||
    (editable && (coins === undefined || coins < 0)) ||
    population === undefined ||
    population < 0 ||
    mapWidth !== 100 ||
    mapHeight !== 100 ||
    catalogVersion === undefined ||
    catalogVersion < 0 ||
    !Array.isArray(value.buildings) ||
    !Array.isArray(value.unlocked_areas)
  ) {
    return null
  }

  const buildings = value.buildings.map(mapPlacedBuilding)
  const unlockedAreas = value.unlocked_areas.map(mapUnlockedArea)
  if (
    buildings.some((building) => building === null) ||
    unlockedAreas.some((area) => area === null)
  ) {
    return null
  }

  const town: TownDetail = {
    town: {
      id: value.town_id,
      owner: {
        id: value.owner_id,
        displayName: value.display_name,
      },
      name: value.town_name,
      ...(editable ? { coins } : {}),
      population,
      mapWidth,
      mapHeight,
    },
    buildings: buildings as TownDetail['buildings'],
    unlockedAreas: unlockedAreas as TownDetail['unlockedAreas'],
    obstacles: [],
    mapLayout: FIXED_MAP_LAYOUT,
    catalogVersion,
    editable,
  }

  return isTownDetail(town) ? town : null
}

function failure<T>(code: ApiErrorCode, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

export function createSupabaseTownApi(
  supabase: SupabaseClient,
  options: SupabaseTownApiOptions = {},
): TownApi {
  const viewNames = { ...DEFAULT_VIEW_NAMES, ...options.viewNames }
  const rpcNames = { ...DEFAULT_RPC_NAMES, ...options.rpcNames }

  return {
    supportsBuildingRename: true,
    async getBuildingCatalog() {
      try {
        const { data, error } = await supabase
          .from(viewNames.buildingCatalog)
          .select(CATALOG_COLUMNS)
          .order('code', { ascending: true })

        if (error) {
          return supabaseFailure(error, {
            fallbackMessage: '建物カタログを読み込めませんでした。',
          })
        }

        if (!Array.isArray(data)) {
          return failure('INTERNAL_ERROR', '建物カタログを読み込めませんでした。')
        }
        const catalog = data.map(mapCatalogItem)
        if (
          catalog.some((item) => item === null) ||
          !isBuildingCatalog(catalog)
        ) {
          return failure('INTERNAL_ERROR', '建物カタログを読み込めませんでした。')
        }

        return { ok: true, data: catalog }
      } catch {
        return failure('INTERNAL_ERROR', '建物カタログを読み込めませんでした。')
      }
    },

    async getMyTown() {
      try {
        const { data, error } = await supabase
          .from(viewNames.myTownDetails)
          .select(MY_TOWN_COLUMNS)
          .maybeSingle()

        if (error) {
          return supabaseFailure(error, {
            fallbackMessage: '街のデータを読み込めませんでした。',
          })
        }
        if (data === null) {
          return failure('NOT_FOUND', '街が見つかりませんでした。')
        }

        const town = mapTownDetail(data, true)
        return town
          ? { ok: true, data: town }
          : failure('INTERNAL_ERROR', '街のデータを読み込めませんでした。')
      } catch {
        return failure('INTERNAL_ERROR', '街のデータを読み込めませんでした。')
      }
    },

    async getPublicTown(userId) {
      if (!UUID_PATTERN.test(userId)) {
        return failure('INVALID_INPUT', 'ユーザーを特定できませんでした。')
      }

      try {
        const { data, error } = await supabase
          .from(viewNames.publicTownDetails)
          .select(PUBLIC_TOWN_COLUMNS)
          .eq('owner_id', userId)
          .maybeSingle()

        if (error) {
          return supabaseFailure(error, {
            fallbackMessage: '公開街を読み込めませんでした。',
          })
        }
        if (data === null) {
          return failure('NOT_FOUND', '街が見つかりませんでした。')
        }

        const town = mapTownDetail(data, false)
        return town
          ? { ok: true, data: town }
          : failure('INTERNAL_ERROR', '公開街を読み込めませんでした。')
      } catch {
        return failure('INTERNAL_ERROR', '公開街を読み込めませんでした。')
      }
    },

    async placeBuilding(input): Promise<ApiResult<TownMutationResult>> {
      if (
        !isNonEmptyString(input.buildingTypeCode) ||
        !Number.isSafeInteger(input.anchorX) ||
        input.anchorX < 0 ||
        !Number.isSafeInteger(input.anchorY) ||
        input.anchorY < 0 ||
        !UUID_PATTERN.test(input.requestId)
      ) {
        return failure('INVALID_INPUT', '配置内容を確認してください。')
      }

      try {
        const { data, error } = await supabase.rpc(rpcNames.placeBuilding, {
          p_building_type_code: input.buildingTypeCode,
          p_anchor_x: input.anchorX,
          p_anchor_y: input.anchorY,
          p_request_id: input.requestId,
        })
        if (error) {
          return supabaseFailure(error, {
            fallbackMessage: '建物を配置できませんでした。',
          })
        }

        return parseRpcResult(
          data,
          mapTownMutationResult,
          '建物を配置できませんでした。',
        )
      } catch {
        return failure('INTERNAL_ERROR', '建物を配置できませんでした。')
      }
    },
    async placeRoadLine(input): Promise<ApiResult<PlaceRoadLineResult>> {
      const cellKeys = new Set(input.cells.map((cell) => `${cell.x}:${cell.y}`))
      if (
        input.buildingTypeCode !== 'road' ||
        input.cells.length < 1 ||
        input.cells.length > 100 ||
        cellKeys.size !== input.cells.length ||
        input.cells.some(
          (cell) =>
            !Number.isSafeInteger(cell.x) ||
            cell.x < 0 ||
            !Number.isSafeInteger(cell.y) ||
            cell.y < 0,
        ) ||
        !UUID_PATTERN.test(input.requestId)
      ) {
        return failure('INVALID_INPUT', '道路の配置内容を確認してください。')
      }

      try {
        const { data, error } = await supabase.rpc(rpcNames.placeRoadLine, {
          p_building_type_code: input.buildingTypeCode,
          p_cells: input.cells,
          p_request_id: input.requestId,
        })
        if (error) {
          return supabaseFailure(error, {
            fallbackMessage: '道路を配置できませんでした。',
          })
        }

        return parseRpcResult(
          data,
          mapPlaceRoadLineResult,
          '道路を配置できませんでした。',
        )
      } catch {
        return failure('INTERNAL_ERROR', '道路を配置できませんでした。')
      }
    },
    async moveBuilding(input): Promise<ApiResult<TownMutationResult>> {
      if (
        !UUID_PATTERN.test(input.buildingId) ||
        !Number.isSafeInteger(input.anchorX) ||
        input.anchorX < 0 ||
        !Number.isSafeInteger(input.anchorY) ||
        input.anchorY < 0 ||
        !UUID_PATTERN.test(input.requestId)
      ) {
        return failure('INVALID_INPUT', '移動内容を確認してください。')
      }

      try {
        const { data, error } = await supabase.rpc(rpcNames.moveBuilding, {
          p_building_id: input.buildingId,
          p_anchor_x: input.anchorX,
          p_anchor_y: input.anchorY,
          p_request_id: input.requestId,
        })
        if (error) {
          return supabaseFailure(error, {
            fallbackMessage: '建物を移動できませんでした。',
          })
        }

        return parseRpcResult(
          data,
          mapTownMutationResult,
          '建物を移動できませんでした。',
        )
      } catch {
        return failure('INTERNAL_ERROR', '建物を移動できませんでした。')
      }
    },
    async deleteRoad(input): Promise<ApiResult<DeleteRoadResult>> {
      if (
        !UUID_PATTERN.test(input.buildingId) ||
        !UUID_PATTERN.test(input.requestId)
      ) {
        return failure('INVALID_INPUT', '削除する道路を確認してください。')
      }

      try {
        const { data, error } = await supabase.rpc(rpcNames.deleteRoad, {
          p_building_id: input.buildingId,
          p_request_id: input.requestId,
        })
        if (error) {
          return supabaseFailure(error, {
            fallbackMessage: '道路を削除できませんでした。',
          })
        }

        return parseRpcResult(
          data,
          mapDeleteRoadResult,
          '道路を削除できませんでした。',
        )
      } catch {
        return failure('INTERNAL_ERROR', '道路を削除できませんでした。')
      }
    },
    async renameBuilding(input): Promise<ApiResult<RenameBuildingResult>> {
      const normalizedName = input.customName?.trim() ?? null
      if (
        !UUID_PATTERN.test(input.buildingId) ||
        (normalizedName !== null &&
          (normalizedName.length < 1 || normalizedName.length > 30 ||
            hasControlCharacter(normalizedName)))
      ) {
        return failure('INVALID_INPUT', '建物名を確認してください。')
      }

      try {
        const { data, error } = await supabase.rpc(rpcNames.renameBuilding, {
          p_building_id: input.buildingId,
          p_custom_name: normalizedName,
        })
        if (error) {
          return supabaseFailure(error, {
            fallbackMessage: '建物名を変更できませんでした。',
          })
        }

        return parseRpcResult(
          data,
          mapRenameBuildingResult,
          '建物名を変更できませんでした。',
        )
      } catch {
        return failure('INTERNAL_ERROR', '建物名を変更できませんでした。')
      }
    },
    async unlockLand(input): Promise<ApiResult<UnlockLandResult>> {
      if (
        !Number.isSafeInteger(input.x) ||
        input.x < 0 ||
        !Number.isSafeInteger(input.y) ||
        input.y < 0 ||
        !UUID_PATTERN.test(input.requestId)
      ) {
        return failure('INVALID_INPUT', '土地開放の内容を確認してください。')
      }

      try {
        const { data, error } = await supabase.rpc(rpcNames.unlockLand, {
          p_x: input.x,
          p_y: input.y,
          p_request_id: input.requestId,
        })
        if (error) {
          return supabaseFailure(error, {
            fallbackMessage: '土地を開放できませんでした。',
          })
        }

        return parseRpcResult(
          data,
          mapUnlockLandResult,
          '土地を開放できませんでした。',
        )
      } catch {
        return failure('INTERNAL_ERROR', '土地を開放できませんでした。')
      }
    },
  }
}
