import type {
  BuildingCatalogItem,
  PlacedBuilding,
  TownDetail,
} from '../../features/town/types'
import { MOCK_RANKING_ENTRIES } from './rankings'
import { FIXED_MAP_LAYOUT } from './map-layout'

const MOCK_TIMESTAMP = '2026-08-26T00:00:00.000Z'

function createPlacedBuilding(
  id: string,
  buildingTypeCode: string,
  anchorX: number,
  anchorY: number,
): PlacedBuilding {
  return {
    id,
    buildingTypeCode,
    customName: null,
    anchorX,
    anchorY,
    roadStructureId: null,
    roadVariant: buildingTypeCode === 'road' ? 'normal' : null,
    createdAt: MOCK_TIMESTAMP,
    updatedAt: MOCK_TIMESTAMP,
  }
}

export const MOCK_PUBLIC_USER_ID = 'mock-user-002'

function createModelCatalogItem(
  code: string,
  name: string,
  category: string,
  size: 1 | 2,
  costCoins: number,
  description: string,
  effects: BuildingCatalogItem['effects'] = [],
): BuildingCatalogItem {
  return {
    code,
    name,
    category,
    width: size,
    height: size,
    costCoins,
    enabled: true,
    description,
    effects,
    assetKey: code,
    catalogVersion: 1,
  }
}

export const MOCK_BUILDING_CATALOG: BuildingCatalogItem[] = [
  {
    code: 'road',
    name: '道路',
    category: 'road',
    width: 1,
    height: 1,
    costCoins: 0,
    enabled: true,
    description: '建物を隣接して配置するための道路です',
    effects: [
      {
        type: 'enables_adjacent_construction',
        value: null,
        targetCategory: null,
        scope: null,
        stackingRule: null,
        description: '周辺への建築を可能にします',
        metadata: {},
      },
    ],
    assetKey: 'road',
    catalogVersion: 1,
  },
  {
    code: 'small_house',
    name: '住宅（小）',
    category: 'residential',
    width: 1,
    height: 1,
    costCoins: 50,
    enabled: true,
    description: '人口が10人増加する1×1サイズの住宅です',
    effects: [
      {
        type: 'population_flat',
        value: 10,
        targetCategory: null,
        scope: null,
        stackingRule: null,
        description: '人口を10増やします',
        metadata: {},
      },
    ],
    assetKey: 'small_house',
    catalogVersion: 1,
  },
  {
    code: 'apartment',
    name: '住宅（大）',
    category: 'residential',
    width: 2,
    height: 2,
    costCoins: 200,
    enabled: true,
    description: '人口を50人増加する2×2サイズの住宅です',
    effects: [
      {
        type: 'population_flat',
        value: 50,
        targetCategory: null,
        scope: null,
        stackingRule: null,
        description: '人口を50人増加します',
        metadata: {},
      },
    ],
    assetKey: 'apartment',
    catalogVersion: 1,
  },
  createModelCatalogItem(
    'small_park',
    '公園',
    'nature',
    1,
    150,
    '街に緑を加える公園です',
  ),
  createModelCatalogItem(
    'hospital',
    '病院',
    'public',
    2,
    600,
    '街の医療を支える病院です',
  ),
  createModelCatalogItem(
    'commercial',
    '商業施設',
    'commercial',
    1,
    300,
    '歩数同期時のコイン獲得を増やす商業施設です',
    [
      {
        type: 'step_coin_bonus_percent',
        value: 10,
        targetCategory: null,
        scope: 'step_sync',
        stackingRule: 'commercial_first_combined_cap',
        description: '歩数同期時の獲得コインを10%増やします',
        metadata: {
          maxEffectiveCount: 3,
          combinedCapPercent: 50,
          priority: 1,
        },
      },
    ],
  ),
  createModelCatalogItem(
    'farm',
    '農場',
    'nature',
    2,
    100,
    '人口が5人増加する農場です',
    [
      {
        type: 'population_flat',
        value: 5,
        targetCategory: null,
        scope: null,
        stackingRule: null,
        description: '人口を5増やします',
        metadata: {},
      },
    ],
  ),
  createModelCatalogItem(
    'town_hall',
    '役所',
    'public',
    2,
    3_000,
    '住宅への人口効果を持つ役所です',
    [
      {
        type: 'residential_population_bonus',
        value: 20,
        targetCategory: 'residential',
        scope: null,
        stackingRule: null,
        description: '対象の住宅人口を20増やします',
        metadata: { enabledForPopulationCalculation: false },
      },
    ],
  ),
  createModelCatalogItem(
    'factory',
    '工場',
    'industry',
    2,
    700,
    '歩数同期時のコイン獲得を増やす工場です',
    [
      {
        type: 'step_coin_bonus_percent',
        value: 25,
        targetCategory: null,
        scope: 'step_sync',
        stackingRule: 'commercial_first_combined_cap',
        description: '歩数同期時の獲得コインを25%増やします',
        metadata: {
          maxEffectiveCount: 2,
          combinedCapPercent: 50,
          priority: 2,
        },
      },
    ],
  ),
]

export const MOCK_MY_TOWN: TownDetail = {
  town: {
    id: 'mock-town-001',
    owner: {
      id: 'mock-user-001',
      displayName: 'Walk City テストユーザー',
    },
    name: 'グリーンタウン',
    coins: 2_000,
    population: 60,
    mapWidth: 100,
    mapHeight: 100,
  },
  buildings: [
    ...Array.from({ length: 7 }, (_, index) =>
      createPlacedBuilding(
        `mock-road-${String(index + 1).padStart(3, '0')}`,
        'road',
        index + 42,
        50,
      ),
    ),
    createPlacedBuilding('mock-house-001', 'small_house', 43, 49),
    createPlacedBuilding('mock-apartment-001', 'apartment', 46, 48),
  ],
  unlockedAreas: [{ x: 40, y: 40, width: 20, height: 20 }],
  obstacles: [],
  mapLayout: FIXED_MAP_LAYOUT,
  catalogVersion: 1,
  editable: true,
}

export const MOCK_PUBLIC_TOWN: TownDetail = {
  town: {
    id: 'mock-town-002',
    owner: {
      id: MOCK_PUBLIC_USER_ID,
      displayName: 'シティウォーカー',
    },
    name: 'ブルータウン',
    population: 60,
    mapWidth: 100,
    mapHeight: 100,
  },
  buildings: [
    ...Array.from({ length: 5 }, (_, index) =>
      createPlacedBuilding(
        `public-road-${String(index + 1).padStart(3, '0')}`,
        'road',
        index + 45,
        47,
      ),
    ),
    createPlacedBuilding('public-house-001', 'small_house', 46, 46),
    createPlacedBuilding('public-apartment-001', 'apartment', 48, 45),
  ],
  unlockedAreas: [{ x: 40, y: 40, width: 20, height: 20 }],
  obstacles: [],
  mapLayout: FIXED_MAP_LAYOUT,
  catalogVersion: 1,
  editable: false,
}

export const MOCK_PUBLIC_LONG_NAME_USER_ID = 'mock-user-long-name'
export const MOCK_PUBLIC_ZERO_POPULATION_USER_ID = 'mock-user-zero-population'
export const MOCK_PUBLIC_LARGE_POPULATION_USER_ID =
  'mock-user-large-population'
export const MOCK_PUBLIC_OWNER_MISMATCH_USER_ID =
  'mock-contract-owner-mismatch'
export const MOCK_PUBLIC_EDITABLE_USER_ID = 'mock-contract-editable'
export const MOCK_PUBLIC_INVALID_POPULATION_USER_ID =
  'mock-contract-invalid-population'

function createPublicProfileTown(
  userId: string,
  townId: string,
  displayName: string,
  townName: string,
  population: number,
): TownDetail {
  return {
    town: {
      id: townId,
      owner: { id: userId, displayName },
      name: townName,
      population,
      mapWidth: 100,
      mapHeight: 100,
    },
    buildings: [],
    unlockedAreas: [{ x: 40, y: 40, width: 20, height: 20 }],
    obstacles: [],
    mapLayout: FIXED_MAP_LAYOUT,
    catalogVersion: 1,
    editable: false,
  }
}

export const MOCK_PUBLIC_LONG_NAME_TOWN = createPublicProfileTown(
  MOCK_PUBLIC_LONG_NAME_USER_ID,
  'mock-town-long-name',
  '毎日の散歩で日本全国の街並みを巡ることを夢見るロングネームウォーカー',
  '緑と水辺と小さな商店街がどこまでも続くウォーカーフレンドリーシティ',
  123_456,
)

export const MOCK_PUBLIC_ZERO_POPULATION_TOWN = createPublicProfileTown(
  MOCK_PUBLIC_ZERO_POPULATION_USER_ID,
  'mock-town-zero-population',
  'はじめてのウォーカー',
  'これから始まる街',
  0,
)

export const MOCK_PUBLIC_LARGE_POPULATION_TOWN = createPublicProfileTown(
  MOCK_PUBLIC_LARGE_POPULATION_USER_ID,
  'mock-town-large-population',
  'メガシティウォーカー',
  'ウォークメガロポリス',
  Number.MAX_SAFE_INTEGER,
)

export const MOCK_PUBLIC_OWNER_MISMATCH_TOWN = createPublicProfileTown(
  'unexpected-owner-id',
  'mock-town-owner-mismatch',
  '所有者不一致ユーザー',
  '所有者不一致の街',
  100,
)

export const MOCK_PUBLIC_EDITABLE_TOWN: TownDetail = {
  ...createPublicProfileTown(
    MOCK_PUBLIC_EDITABLE_USER_ID,
    'mock-town-editable-contract',
    '編集可能レスポンスユーザー',
    '編集可能になっている公開街',
    100,
  ),
  editable: true,
}

export const MOCK_PUBLIC_INVALID_POPULATION_TOWN = createPublicProfileTown(
  MOCK_PUBLIC_INVALID_POPULATION_USER_ID,
  'mock-town-invalid-population',
  '人口不正ユーザー',
  '人口値が不正な街',
  Number.NaN,
)

export const MOCK_RANKING_PUBLIC_TOWNS: Record<string, TownDetail> =
  Object.fromEntries(
    MOCK_RANKING_ENTRIES.map((entry) => [
      entry.userId,
      createPublicProfileTown(
        entry.userId,
        entry.townId,
        entry.displayName,
        entry.townName,
        entry.population,
      ),
    ]),
  )

export const MOCK_PUBLIC_TOWNS: Record<string, TownDetail> = {
  ...MOCK_RANKING_PUBLIC_TOWNS,
  [MOCK_PUBLIC_USER_ID]: MOCK_PUBLIC_TOWN,
  [MOCK_PUBLIC_LONG_NAME_USER_ID]: MOCK_PUBLIC_LONG_NAME_TOWN,
  [MOCK_PUBLIC_ZERO_POPULATION_USER_ID]: MOCK_PUBLIC_ZERO_POPULATION_TOWN,
  [MOCK_PUBLIC_LARGE_POPULATION_USER_ID]: MOCK_PUBLIC_LARGE_POPULATION_TOWN,
  [MOCK_PUBLIC_OWNER_MISMATCH_USER_ID]: MOCK_PUBLIC_OWNER_MISMATCH_TOWN,
  [MOCK_PUBLIC_EDITABLE_USER_ID]: MOCK_PUBLIC_EDITABLE_TOWN,
  [MOCK_PUBLIC_INVALID_POPULATION_USER_ID]:
    MOCK_PUBLIC_INVALID_POPULATION_TOWN,
}

export const MOCK_EMPTY_TOWN: TownDetail = {
  town: {
    ...MOCK_MY_TOWN.town,
    id: 'mock-town-empty',
    name: 'まだ何もない街',
    population: 0,
  },
  buildings: [],
  unlockedAreas: MOCK_MY_TOWN.unlockedAreas.map((area) => ({ ...area })),
  obstacles: [],
  mapLayout: FIXED_MAP_LAYOUT,
  catalogVersion: 1,
  editable: true,
}

export const MOCK_INSUFFICIENT_COINS_TOWN: TownDetail = {
  ...MOCK_MY_TOWN,
  town: {
    ...MOCK_MY_TOWN.town,
    id: 'mock-town-low-coins',
    name: 'コイン不足の街',
    coins: 5,
  },
  buildings: MOCK_MY_TOWN.buildings.map((building) => ({ ...building })),
  unlockedAreas: MOCK_MY_TOWN.unlockedAreas.map((area) => ({ ...area })),
  obstacles: [],
}
