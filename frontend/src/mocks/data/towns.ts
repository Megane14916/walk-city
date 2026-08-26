import type {
  BuildingCatalogItem,
  PlacedBuilding,
  TownDetail,
} from '../../features/town/types'

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
    anchorX,
    anchorY,
    createdAt: MOCK_TIMESTAMP,
    updatedAt: MOCK_TIMESTAMP,
  }
}

export const MOCK_PUBLIC_USER_ID = 'mock-user-002'

export const MOCK_BUILDING_CATALOG: BuildingCatalogItem[] = [
  {
    code: 'road',
    name: '道路',
    category: 'road',
    width: 1,
    height: 1,
    costCoins: 10,
    enabled: true,
    description: '建物を隣接して配置するための道路です',
    effects: [],
    assetKey: 'road',
    catalogVersion: 1,
  },
  {
    code: 'house-small',
    name: '小さな家',
    category: 'residential',
    width: 1,
    height: 1,
    costCoins: 100,
    enabled: true,
    description: '1×1サイズの住宅です',
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
    assetKey: 'house-small',
    catalogVersion: 1,
  },
  {
    code: 'apartment',
    name: 'アパート',
    category: 'residential',
    width: 2,
    height: 2,
    costCoins: 300,
    enabled: true,
    description: '2×2サイズの集合住宅です',
    effects: [
      {
        type: 'population_flat',
        value: 40,
        targetCategory: null,
        scope: null,
        stackingRule: null,
        description: '人口を40増やします',
        metadata: {},
      },
    ],
    assetKey: 'apartment',
    catalogVersion: 1,
  },
  {
    code: 'park',
    name: '公園',
    category: 'public',
    width: 2,
    height: 2,
    costCoins: 200,
    enabled: true,
    description: '街の人口効果を高める2×2サイズの公園です',
    effects: [
      {
        type: 'residential_population_bonus',
        value: 5,
        targetCategory: 'residential',
        scope: 'town',
        stackingRule: null,
        description: '住宅の人口効果にボーナスを与えます',
        metadata: {},
      },
    ],
    assetKey: 'park',
    catalogVersion: 1,
  },
  {
    code: 'future-building',
    name: '準備中の建物',
    category: 'special',
    width: 1,
    height: 1,
    costCoins: null,
    enabled: false,
    description: '価格と効果を調整中の建物です',
    effects: [],
    assetKey: 'future-building',
    catalogVersion: 1,
  },
]

export const MOCK_MY_TOWN: TownDetail = {
  town: {
    id: 'mock-town-001',
    owner: {
      id: 'mock-user-001',
      displayName: 'Walk City テストユーザー',
    },
    name: 'グリーンタウン',
    coins: 500,
    population: 50,
    mapWidth: 100,
    mapHeight: 100,
  },
  buildings: [
    ...Array.from({ length: 7 }, (_, index) =>
      createPlacedBuilding(
        `mock-road-${String(index + 1).padStart(3, '0')}`,
        'road',
        index + 2,
        10,
      ),
    ),
    createPlacedBuilding('mock-house-001', 'house-small', 3, 9),
    createPlacedBuilding('mock-apartment-001', 'apartment', 6, 8),
  ],
  unlockedAreas: [{ x: 0, y: 0, width: 20, height: 20 }],
  obstacles: [],
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
    population: 50,
    mapWidth: 100,
    mapHeight: 100,
  },
  buildings: [
    ...Array.from({ length: 5 }, (_, index) =>
      createPlacedBuilding(
        `public-road-${String(index + 1).padStart(3, '0')}`,
        'road',
        index + 10,
        12,
      ),
    ),
    createPlacedBuilding('public-house-001', 'house-small', 11, 11),
    createPlacedBuilding('public-apartment-001', 'apartment', 13, 10),
  ],
  unlockedAreas: [{ x: 5, y: 5, width: 20, height: 20 }],
  obstacles: [],
  catalogVersion: 1,
  editable: false,
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
