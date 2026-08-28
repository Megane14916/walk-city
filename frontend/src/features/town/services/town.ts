import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseFailure } from '../../../lib/supabase-api'
import type { ApiErrorCode, ApiResult } from '../../../types/common'
import type { TownApi } from '../api'
import type {
  BuildingCatalogItem,
  BuildingEffect,
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

export type SupabaseTownApiOptions = {
  viewNames?: Partial<SupabaseTownViewNames>
}

const DEFAULT_VIEW_NAMES: SupabaseTownViewNames = {
  buildingCatalog: 'building_catalog_view',
  myTownDetails: 'my_town_details_view',
  publicTownDetails: 'public_town_details_view',
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
  if (type === 'step_coin_bonus_flat' && value !== null) {
    return `歩数同期時のコインを${value}増やします`
  }
  if (type === 'residential_population_bonus' && value !== null) {
    return `対象の住宅人口を${value}増やします`
  }
  if (type === 'enables_adjacent_construction') {
    return '周辺への建築を可能にします'
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

  const anchorX = toSafeInteger(value.anchor_x)
  const anchorY = toSafeInteger(value.anchor_y)
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.building_type_code) ||
    anchorX === undefined ||
    anchorX < 0 ||
    anchorY === undefined ||
    anchorY < 0 ||
    !isNonEmptyString(value.created_at) ||
    !isNonEmptyString(value.updated_at)
  ) {
    return null
  }

  return {
    id: value.id,
    buildingTypeCode: value.building_type_code,
    customName: null,
    anchorX,
    anchorY,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  }
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
    catalogVersion,
    editable,
  }

  return isTownDetail(town) ? town : null
}

function failure<T>(code: ApiErrorCode, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } }
}

function unavailableMutation<T>(): ApiResult<T> {
  return failure('INTERNAL_ERROR', '街更新APIは現在準備中です。')
}

export function createSupabaseTownApi(
  supabase: SupabaseClient,
  options: SupabaseTownApiOptions = {},
): TownApi {
  const viewNames = { ...DEFAULT_VIEW_NAMES, ...options.viewNames }

  return {
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

    async placeBuilding(): Promise<ApiResult<TownMutationResult>> {
      return unavailableMutation()
    },
    async placeRoadLine(): Promise<ApiResult<PlaceRoadLineResult>> {
      return unavailableMutation()
    },
    async moveBuilding(): Promise<ApiResult<TownMutationResult>> {
      return unavailableMutation()
    },
    async renameBuilding(): Promise<ApiResult<RenameBuildingResult>> {
      return unavailableMutation()
    },
    async unlockLand(): Promise<ApiResult<UnlockLandResult>> {
      return unavailableMutation()
    },
  }
}
