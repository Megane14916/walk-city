import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseTownApi } from './town'

type QueryResult = { data: unknown; error: unknown }

function createSupabaseMock(
  results: Record<string, QueryResult>,
  rpcResults: Record<string, QueryResult> = {},
) {
  const selections: Array<{ view: string; columns: string }> = []
  const filters: Array<{ view: string; column: string; value: unknown }> = []

  const from = vi.fn((view: string) => ({
    select: vi.fn((columns: string) => {
      selections.push({ view, columns })
      const result = results[view] ?? { data: null, error: null }
      return {
        order: vi.fn().mockResolvedValue(result),
        maybeSingle: vi.fn().mockResolvedValue(result),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push({ view, column, value })
          return { maybeSingle: vi.fn().mockResolvedValue(result) }
        }),
      }
    }),
  }))
  const rpc = vi.fn((name: string) =>
    Promise.resolve(rpcResults[name] ?? { data: null, error: null }),
  )

  return {
    client: { from, rpc } as unknown as SupabaseClient,
    from,
    rpc,
    selections,
    filters,
  }
}

const CATALOG_ROW = {
  code: 'small_house',
  name: '住宅（小）',
  category: 'residential',
  width: 1,
  height: 1,
  cost_coins: '50',
  enabled: true,
  description: '人口が増える住宅です',
  catalog_version: 1,
  effects: [
    {
      effect_type: 'population_flat',
      value: '10',
      target_category: null,
      scope: null,
      stacking_rule: null,
      metadata: {},
    },
  ],
}

const BUILDING_ROW = {
  id: '10000000-0000-4000-8000-000000000001',
  building_type_code: 'small_house',
  anchor_x: 43,
  anchor_y: 49,
  created_at: '2026-08-29T00:00:00.000Z',
  updated_at: '2026-08-29T00:00:00.000Z',
}

const MY_TOWN_ROW = {
  town_id: '20000000-0000-4000-8000-000000000001',
  owner_id: '30000000-0000-4000-8000-000000000001',
  display_name: 'テストユーザー',
  town_name: 'テストタウン',
  coins: '1000',
  population: '10',
  map_width: 100,
  map_height: 100,
  buildings: [BUILDING_ROW],
  unlocked_areas: [{ x: 40, y: 40, width: 20, height: 20 }],
  catalog_version: 1,
}

const PUBLIC_USER_ID = '40000000-0000-4000-8000-000000000001'
const PUBLIC_TOWN_ROW = {
  ...MY_TOWN_ROW,
  owner_id: PUBLIC_USER_ID,
  display_name: '公開ユーザー',
  town_id: '50000000-0000-4000-8000-000000000001',
  town_name: '公開タウン',
  coins: undefined,
}

const REQUEST_ID = '60000000-0000-4000-8000-000000000001'
const MUTATION_ROW = {
  building: {
    ...BUILDING_ROW,
    id: '70000000-0000-4000-8000-000000000001',
    anchor_x: 40,
    anchor_y: 40,
    updated_at: '2026-08-29T01:00:00.000Z',
  },
  coin_balance: '950',
  population: '20',
  updated_at: '2026-08-29T01:00:00.000Z',
}

describe('createSupabaseTownApi', () => {
  it('maps the building catalog view into the frontend contract', async () => {
    const mock = createSupabaseMock({
      building_catalog_view: { data: [CATALOG_ROW], error: null },
    })
    const api = createSupabaseTownApi(mock.client)

    await expect(api.getBuildingCatalog()).resolves.toEqual({
      ok: true,
      data: [
        {
          code: 'small_house',
          name: '住宅（小）',
          category: 'residential',
          width: 1,
          height: 1,
          costCoins: 50,
          enabled: true,
          description: '人口が増える住宅です',
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
      ],
    })
    expect(mock.from).toHaveBeenCalledWith('building_catalog_view')
  })

  it('describes the park adjacency effect from the catalog', async () => {
    const mock = createSupabaseMock({
      building_catalog_view: {
        data: [
          {
            ...CATALOG_ROW,
            code: 'small_park',
            name: '公園',
            category: 'nature',
            cost_coins: '150',
            description: '隣接する住宅の人口を増加する公園です',
            effects: [
              {
                effect_type: 'adjacent_small_house_population_flat',
                value: '5',
                target_category: 'residential',
                scope: 'orthogonal_adjacent',
                stacking_rule: 'unique_target',
                metadata: {},
              },
              {
                effect_type: 'adjacent_apartment_population_flat',
                value: '10',
                target_category: 'residential',
                scope: 'orthogonal_adjacent',
                stacking_rule: 'unique_target',
                metadata: {},
              },
            ],
          },
        ],
        error: null,
      },
    })
    const api = createSupabaseTownApi(mock.client)

    await expect(api.getBuildingCatalog()).resolves.toMatchObject({
      ok: true,
      data: [
        {
          code: 'small_park',
          effects: [
            {
              type: 'adjacent_small_house_population_flat',
              value: 5,
              description:
                '上下左右に隣接する住宅（小）1軒につき人口を5増やします',
            },
            {
              type: 'adjacent_apartment_population_flat',
              value: 10,
              description:
                '上下左右に隣接する住宅（大）1軒につき人口を10増やします',
            },
          ],
        },
      ],
    })
  })

  it('describes both hospital housing effects from the catalog', async () => {
    const mock = createSupabaseMock({
      building_catalog_view: {
        data: [
          {
            ...CATALOG_ROW,
            code: 'hospital',
            name: '病院',
            category: 'public',
            cost_coins: '600',
            description: '町内の住宅数に応じて人口を増加する病院です',
            effects: [
              {
                effect_type: 'small_house_population_flat',
                value: '5',
                target_category: 'residential',
                scope: 'town',
                stacking_rule: 'single_source',
                metadata: {},
              },
              {
                effect_type: 'apartment_population_flat',
                value: '10',
                target_category: 'residential',
                scope: 'town',
                stacking_rule: 'single_source',
                metadata: {},
              },
            ],
          },
        ],
        error: null,
      },
    })
    const api = createSupabaseTownApi(mock.client)

    await expect(api.getBuildingCatalog()).resolves.toMatchObject({
      ok: true,
      data: [
        {
          code: 'hospital',
          effects: [
            {
              type: 'small_house_population_flat',
              value: 5,
              description: '町内の住宅（小）1軒につき人口を5増やします',
            },
            {
              type: 'apartment_population_flat',
              value: 10,
              description: '町内の住宅（大）1軒につき人口を10増やします',
            },
          ],
        },
      ],
    })
  })

  it('maps the authenticated town and includes its coin balance', async () => {
    const mock = createSupabaseMock({
      my_town_details_view: { data: MY_TOWN_ROW, error: null },
    })
    const api = createSupabaseTownApi(mock.client)

    const result = await api.getMyTown()

    expect(result).toMatchObject({
      ok: true,
      data: {
        town: {
          id: MY_TOWN_ROW.town_id,
          owner: {
            id: MY_TOWN_ROW.owner_id,
            displayName: 'テストユーザー',
          },
          coins: 1000,
          population: 10,
        },
        buildings: [
          {
            buildingTypeCode: 'small_house',
            customName: null,
            anchorX: 43,
            anchorY: 49,
          },
        ],
        obstacles: [],
        editable: true,
      },
    })
  })

  it('selects only public fields and omits coins from a public town', async () => {
    const publicRow: Record<string, unknown> = { ...PUBLIC_TOWN_ROW }
    delete publicRow.coins
    const mock = createSupabaseMock({
      public_town_details_view: { data: publicRow, error: null },
    })
    const api = createSupabaseTownApi(mock.client)

    const result = await api.getPublicTown(PUBLIC_USER_ID)

    expect(result).toMatchObject({
      ok: true,
      data: {
        town: { owner: { id: PUBLIC_USER_ID }, population: 10 },
        editable: false,
      },
    })
    if (result.ok) expect(result.data.town).not.toHaveProperty('coins')
    expect(mock.filters).toEqual([
      {
        view: 'public_town_details_view',
        column: 'owner_id',
        value: PUBLIC_USER_ID,
      },
    ])
    expect(mock.selections[0].columns).not.toContain('coins')
  })

  it('rejects a non-UUID public user id before querying Supabase', async () => {
    const mock = createSupabaseMock({})
    const api = createSupabaseTownApi(mock.client)

    await expect(api.getPublicTown('not-a-uuid')).resolves.toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'ユーザーを特定できませんでした。',
      },
    })
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('returns NOT_FOUND when the authenticated town does not exist', async () => {
    const mock = createSupabaseMock({
      my_town_details_view: { data: null, error: null },
    })
    const api = createSupabaseTownApi(mock.client)

    await expect(api.getMyTown()).resolves.toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: '街が見つかりませんでした。' },
    })
  })

  it('normalizes PostgREST errors without exposing database details', async () => {
    const mock = createSupabaseMock({
      my_town_details_view: {
        data: null,
        error: { code: '42501', message: 'permission denied for towns' },
      },
    })
    const api = createSupabaseTownApi(mock.client)

    await expect(api.getMyTown()).resolves.toEqual({
      ok: false,
      error: {
        code: 'NOT_OWNER',
        message: 'この操作を行う権限がありません。',
      },
    })
  })

  it('rejects unsafe bigint values and private public-town fields', async () => {
    const catalogMock = createSupabaseMock({
      building_catalog_view: {
        data: [
          {
            ...CATALOG_ROW,
            cost_coins: '9007199254740992',
          },
        ],
        error: null,
      },
    })
    const publicMock = createSupabaseMock({
      public_town_details_view: {
        data: { ...PUBLIC_TOWN_ROW, coins: 10 },
        error: null,
      },
    })

    await expect(
      createSupabaseTownApi(catalogMock.client).getBuildingCatalog(),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    })
    await expect(
      createSupabaseTownApi(publicMock.client).getPublicTown(PUBLIC_USER_ID),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    })
  })

  it('calls place_building with only trusted RPC inputs and maps the result', async () => {
    const mock = createSupabaseMock({}, {
      place_building: { data: { ok: true, data: MUTATION_ROW }, error: null },
    })
    const api = createSupabaseTownApi(mock.client)

    await expect(
      api.placeBuilding({
        buildingTypeCode: 'small_house',
        anchorX: 40,
        anchorY: 40,
        requestId: REQUEST_ID,
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        building: {
          id: MUTATION_ROW.building.id,
          buildingTypeCode: 'small_house',
          customName: null,
          anchorX: 40,
          anchorY: 40,
          roadStructureId: null,
          roadVariant: null,
          createdAt: BUILDING_ROW.created_at,
          updatedAt: MUTATION_ROW.building.updated_at,
        },
        coinBalance: 950,
        population: 20,
        updatedAt: MUTATION_ROW.updated_at,
      },
    })
    expect(mock.rpc).toHaveBeenCalledWith('place_building', {
      p_building_type_code: 'small_house',
      p_anchor_x: 40,
      p_anchor_y: 40,
      p_request_id: REQUEST_ID,
    })
  })

  it('moves a building without sending or deducting coins', async () => {
    const moveResult = { ...MUTATION_ROW, coin_balance: '1000' }
    const mock = createSupabaseMock({}, {
      move_building: { data: { ok: true, data: moveResult }, error: null },
    })
    const api = createSupabaseTownApi(mock.client)

    await expect(
      api.moveBuilding({
        buildingId: MUTATION_ROW.building.id,
        anchorX: 41,
        anchorY: 40,
        requestId: REQUEST_ID,
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: { coinBalance: 1000, population: 20 },
    })
    expect(mock.rpc).toHaveBeenCalledWith('move_building', {
      p_building_id: MUTATION_ROW.building.id,
      p_anchor_x: 41,
      p_anchor_y: 40,
      p_request_id: REQUEST_ID,
    })
  })

  it('rejects invalid mutation input before calling RPC', async () => {
    const mock = createSupabaseMock({})
    const api = createSupabaseTownApi(mock.client)

    await expect(
      api.placeBuilding({
        buildingTypeCode: 'small_house',
        anchorX: 40,
        anchorY: 40,
        requestId: 'not-a-uuid',
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it('maps ownership and malformed mutation responses safely', async () => {
    const denied = createSupabaseMock({}, {
      move_building: {
        data: null,
        error: { code: '42501', message: 'private database detail' },
      },
    })
    const malformed = createSupabaseMock({}, {
      place_building: {
        data: { ok: true, data: { ...MUTATION_ROW, coin_balance: '-1' } },
        error: null,
      },
    })

    await expect(
      createSupabaseTownApi(denied.client).moveBuilding({
        buildingId: MUTATION_ROW.building.id,
        anchorX: 40,
        anchorY: 40,
        requestId: REQUEST_ID,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'NOT_OWNER' } })
    await expect(
      createSupabaseTownApi(malformed.client).placeBuilding({
        buildingTypeCode: 'small_house',
        anchorX: 40,
        anchorY: 40,
        requestId: REQUEST_ID,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } })
  })

  it('calls the road-line RPC with one atomic request and maps its result', async () => {
    const roadResult = {
      buildings: [
        { ...BUILDING_ROW, id: '80000000-0000-4000-8000-000000000001' },
        {
          ...BUILDING_ROW,
          id: '80000000-0000-4000-8000-000000000002',
          anchor_x: 44,
        },
      ],
      coin_balance: '900',
      population: '20',
      updated_at: '2026-08-29T02:00:00.000Z',
    }
    const mock = createSupabaseMock({}, {
      place_road_line: { data: { ok: true, data: roadResult }, error: null },
    })
    const api = createSupabaseTownApi(mock.client)
    const cells = [{ x: 43, y: 49 }, { x: 44, y: 49 }]

    await expect(
      api.placeRoadLine({
        buildingTypeCode: 'road',
        cells,
        requestId: REQUEST_ID,
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: {
        buildings: [{ anchorX: 43 }, { anchorX: 44 }],
        coinBalance: 900,
        population: 20,
      },
    })
    expect(mock.rpc).toHaveBeenCalledWith('place_road_line', {
      p_building_type_code: 'road',
      p_cells: cells,
      p_request_id: REQUEST_ID,
    })
  })

  it('calls the coordinate-based land-unlock RPC and maps its result', async () => {
    const mock = createSupabaseMock({}, {
      unlock_land: {
        data: {
          ok: true,
          data: {
            unlocked_area: { x: 20, y: 40, width: 20, height: 20 },
            coin_balance: '0',
            updated_at: '2026-08-29T03:00:00.000Z',
          },
        },
        error: null,
      },
    })
    const api = createSupabaseTownApi(mock.client)

    await expect(
      api.unlockLand({ x: 20, y: 40, requestId: REQUEST_ID }),
    ).resolves.toEqual({
      ok: true,
      data: {
        unlockedArea: { x: 20, y: 40, width: 20, height: 20 },
        coinBalance: 0,
        updatedAt: '2026-08-29T03:00:00.000Z',
      },
    })
    expect(mock.rpc).toHaveBeenCalledWith('unlock_land', {
      p_x: 20,
      p_y: 40,
      p_request_id: REQUEST_ID,
    })
  })

  it('deletes a whole bridge through the production RPC', async () => {
    const bridgeStructureId = '90000000-0000-4000-8000-000000000001'
    const deletedBuildingIds = [
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000002',
    ]
    const mock = createSupabaseMock({}, {
      delete_road: {
        data: {
          ok: true,
          data: {
            deletionKind: 'bridge',
            deletedBuildingIds,
            deletedRoadStructureId: bridgeStructureId,
            coinBalance: '900',
            population: '20',
            updatedAt: '2026-08-29T04:00:00.000Z',
          },
        },
        error: null,
      },
    })
    const api = createSupabaseTownApi(mock.client)

    await expect(
      api.deleteRoad({
        buildingId: deletedBuildingIds[0],
        requestId: REQUEST_ID,
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        deletionKind: 'bridge',
        deletedBuildingIds,
        deletedRoadStructureId: bridgeStructureId,
        coinBalance: 900,
        population: 20,
        updatedAt: '2026-08-29T04:00:00.000Z',
      },
    })
    expect(mock.rpc).toHaveBeenCalledWith('delete_road', {
      p_building_id: deletedBuildingIds[0],
      p_request_id: REQUEST_ID,
    })
  })

  it('rejects malformed road and land inputs before calling RPC', async () => {
    const mock = createSupabaseMock({})
    const api = createSupabaseTownApi(mock.client)

    await expect(
      api.placeRoadLine({
        buildingTypeCode: 'road',
        cells: [{ x: 40, y: 40 }, { x: 40, y: 40 }],
        requestId: REQUEST_ID,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    await expect(
      api.unlockLand({ x: -20, y: 40, requestId: REQUEST_ID }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    await expect(
      api.deleteRoad({
        buildingId: 'not-a-uuid',
        requestId: REQUEST_ID,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it('renames a building through the production RPC', async () => {
    const renamedBuilding = {
      ...BUILDING_ROW,
      custom_name: '新しい名前',
      updated_at: '2026-08-29T05:00:00.000Z',
    }
    const mock = createSupabaseMock({}, {
      rename_building: {
        data: {
          ok: true,
          data: {
            building: renamedBuilding,
            updatedAt: renamedBuilding.updated_at,
          },
        },
        error: null,
      },
    })
    const api = createSupabaseTownApi(mock.client)

    expect(api.supportsBuildingRename).toBe(true)
    await expect(
      api.renameBuilding({
        buildingId: BUILDING_ROW.id,
        customName: '  新しい名前  ',
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: { building: { customName: '新しい名前' } },
    })
    expect(mock.rpc).toHaveBeenCalledWith('rename_building', {
      p_building_id: BUILDING_ROW.id,
      p_custom_name: '新しい名前',
    })
  })

  it('maps an RPC error envelope without exposing database errors', async () => {
    const mock = createSupabaseMock({}, {
      place_building: {
        data: {
          ok: false,
          error: { code: 'RIVER_BLOCKED', message: '川の上には配置できません。' },
        },
        error: null,
      },
    })

    await expect(
      createSupabaseTownApi(mock.client).placeBuilding({
        buildingTypeCode: 'small_house',
        anchorX: 67,
        anchorY: 55,
        requestId: REQUEST_ID,
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'RIVER_BLOCKED', message: '川の上には配置できません。' },
    })
  })
})
