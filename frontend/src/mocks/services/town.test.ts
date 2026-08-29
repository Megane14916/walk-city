import { describe, expect, it } from 'vitest'
import { MOCK_MY_TOWN } from '../data/towns'
import { createMockTownApi } from './town'
import { getRoadLineCells } from '../../features/town/utils'

describe('createMockTownApi building names', () => {
  it('renames a building without changing coins, population, or placement', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    const before = api.getTownSnapshot()

    await expect(
      api.renameBuilding({
        buildingId: 'mock-house-001',
        customName: '  わが家  ',
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: {
        building: {
          id: 'mock-house-001',
          customName: 'わが家',
          anchorX: 43,
          anchorY: 49,
        },
      },
    })

    const after = api.getTownSnapshot()
    expect(after.town.coins).toBe(before.town.coins)
    expect(after.town.population).toBe(before.town.population)
    expect(after.buildings.find((building) => building.id === 'mock-house-001'))
      .toMatchObject({ customName: 'わが家', anchorX: 43, anchorY: 49 })
  })

  it('restores the catalog name and rejects an invalid name', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    await api.renameBuilding({
      buildingId: 'mock-house-001',
      customName: 'わが家',
    })

    await expect(
      api.renameBuilding({
        buildingId: 'mock-house-001',
        customName: null,
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: { building: { customName: null } },
    })
    await expect(
      api.renameBuilding({
        buildingId: 'mock-house-001',
        customName: '   ',
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(
      api
        .getTownSnapshot()
        .buildings.find((building) => building.id === 'mock-house-001')
        ?.customName,
    ).toBeNull()
  })
})

describe('createMockTownApi effect-free model placement', () => {
  it.each([
    ['park', 150, 41, 50],
    ['hospital', 600, 40, 49],
    ['commercial-facility', 300, 41, 50],
    ['farm', 100, 40, 49],
    ['city-hall', 3_000, 40, 49],
    ['factory', 700, 40, 49],
  ])(
    'places %s, deducts only its price, and applies no population effect',
    async (buildingTypeCode, costCoins, anchorX, anchorY) => {
      const initialCoins = 10_000
      const api = createMockTownApi({
        latencyMs: 0,
        initialTown: {
          ...MOCK_MY_TOWN,
          town: { ...MOCK_MY_TOWN.town, coins: initialCoins },
        },
      })

      const result = await api.placeBuilding({
        buildingTypeCode,
        anchorX,
        anchorY,
        requestId: `place-${buildingTypeCode}`,
      })

      expect(result).toMatchObject({
        ok: true,
        data: {
          building: { buildingTypeCode, anchorX, anchorY },
          coinBalance: initialCoins - costCoins,
          population: 60,
        },
      })
      expect(api.getTownSnapshot().town.population).toBe(60)
    },
  )
})

describe('createMockTownApi road line placement', () => {
  it('places a road line atomically and handles a repeated request idempotently', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    const input = {
      buildingTypeCode: 'road',
      cells: getRoadLineCells({ x: 41, y: 52 }, { x: 45, y: 52 }),
      requestId: 'road-line-request-1',
    }

    const first = await api.placeRoadLine(input)
    expect(first).toMatchObject({
      ok: true,
      data: {
        buildings: input.cells.map((cell) => ({
          buildingTypeCode: 'road',
          anchorX: cell.x,
          anchorY: cell.y,
        })),
        coinBalance: 2_000,
      },
    })

    const repeated = await api.placeRoadLine(input)
    expect(repeated).toEqual(first)
    expect(
      api
        .getTownSnapshot()
        .buildings.filter((building) => building.buildingTypeCode === 'road'),
    ).toHaveLength(12)
  })
})

describe('createMockTownApi fixed river validation', () => {
  const initialTown = {
    ...MOCK_MY_TOWN,
    unlockedAreas: [
      ...MOCK_MY_TOWN.unlockedAreas,
      { x: 60, y: 40, width: 20, height: 20 },
    ],
  }

  it('rejects a building placed on the river', async () => {
    const api = createMockTownApi({ latencyMs: 0, initialTown })

    expect(
      await api.placeBuilding({
        buildingTypeCode: 'house-small',
        anchorX: 68,
        anchorY: 50,
        requestId: 'river-building',
      }),
    ).toMatchObject({
      ok: false,
      error: { code: 'RIVER_BLOCKED' },
    })
  })

  it('rejects an incomplete river crossing', async () => {
    const api = createMockTownApi({ latencyMs: 0, initialTown })

    expect(
      await api.placeRoadLine({
        buildingTypeCode: 'road',
        cells: getRoadLineCells({ x: 64, y: 55 }, { x: 68, y: 55 }),
        requestId: 'river-road',
      }),
    ).toMatchObject({
      ok: false,
      error: { code: 'BRIDGE_SPAN_REQUIRED' },
    })
  })

  it('builds a seven-cell bridge atomically and idempotently', async () => {
    const api = createMockTownApi({ latencyMs: 0, initialTown })
    const input = {
      buildingTypeCode: 'road',
      cells: getRoadLineCells({ x: 64, y: 55 }, { x: 70, y: 55 }),
      requestId: 'bridge-road',
    }

    const first = await api.placeRoadLine(input)
    expect(first).toMatchObject({
      ok: true,
      data: {
        placementKind: 'bridge',
        roadStructureId: 'mock-road-structure-001',
        totalCostCoins: 1_000,
        coinBalance: 1_000,
        buildings: input.cells.map((cell) => ({
          buildingTypeCode: 'road',
          anchorX: cell.x,
          anchorY: cell.y,
          roadStructureId: 'mock-road-structure-001',
          roadVariant: 'bridge_horizontal',
        })),
      },
    })

    const repeated = await api.placeRoadLine(input)
    expect(repeated).toEqual(first)
    expect(
      api
        .getTownSnapshot()
        .buildings.filter(
          (building) =>
            building.roadStructureId === 'mock-road-structure-001',
        ),
    ).toHaveLength(7)
  })

  it('does not save a bridge when coins are insufficient', async () => {
    const api = createMockTownApi({
      latencyMs: 0,
      initialTown: {
        ...initialTown,
        town: { ...initialTown.town, coins: 999 },
      },
    })
    const before = api.getTownSnapshot()

    expect(
      await api.placeRoadLine({
        buildingTypeCode: 'road',
        cells: getRoadLineCells({ x: 64, y: 55 }, { x: 70, y: 55 }),
        requestId: 'bridge-insufficient-coins',
      }),
    ).toMatchObject({
      ok: false,
      error: { code: 'INSUFFICIENT_COINS' },
    })
    expect(api.getTownSnapshot()).toEqual(before)
  })
})

describe('createMockTownApi road deletion', () => {
  it('deletes one unused road cell without refunding coins and is idempotent', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    const input = {
      buildingId: 'mock-road-001',
      requestId: 'delete-road-1',
    }

    const first = await api.deleteRoad(input)
    expect(first).toMatchObject({
      ok: true,
      data: {
        deletionKind: 'road',
        deletedBuildingIds: ['mock-road-001'],
        deletedRoadStructureId: null,
        coinBalance: 2_000,
        population: 60,
      },
    })
    expect(await api.deleteRoad(input)).toEqual(first)
    expect(api.getTownSnapshot().town.coins).toBe(2_000)
    expect(
      api
        .getTownSnapshot()
        .buildings.some((building) => building.id === 'mock-road-001'),
    ).toBe(false)
  })

  it('keeps a road when deleting it would disconnect a building', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    const before = api.getTownSnapshot()

    expect(
      await api.deleteRoad({
        buildingId: 'mock-road-002',
        requestId: 'delete-road-in-use',
      }),
    ).toMatchObject({ ok: false, error: { code: 'ROAD_IN_USE' } })
    expect(api.getTownSnapshot()).toEqual(before)
  })

  it('deletes all seven bridge cells atomically without a refund', async () => {
    const initialTown = {
      ...MOCK_MY_TOWN,
      unlockedAreas: [
        ...MOCK_MY_TOWN.unlockedAreas,
        { x: 60, y: 40, width: 20, height: 20 },
      ],
    }
    const api = createMockTownApi({ latencyMs: 0, initialTown })
    const placed = await api.placeRoadLine({
      buildingTypeCode: 'road',
      cells: getRoadLineCells({ x: 64, y: 55 }, { x: 70, y: 55 }),
      requestId: 'bridge-before-delete',
    })
    expect(placed.ok).toBe(true)
    if (!placed.ok) return
    const input = {
      buildingId: placed.data.buildings[3].id,
      requestId: 'delete-bridge-1',
    }

    const deleted = await api.deleteRoad(input)
    expect(deleted).toMatchObject({
      ok: true,
      data: {
        deletionKind: 'bridge',
        deletedRoadStructureId: 'mock-road-structure-001',
        coinBalance: 1_000,
        population: 60,
      },
    })
    if (!deleted.ok) return
    expect(deleted.data.deletedBuildingIds).toHaveLength(7)
    expect(await api.deleteRoad(input)).toEqual(deleted)
    expect(
      api
        .getTownSnapshot()
        .buildings.filter(
          (building) =>
            building.roadStructureId === 'mock-road-structure-001',
        ),
    ).toHaveLength(0)
  })

  it('rejects a broken bridge group and non-road targets without mutation', async () => {
    const road = MOCK_MY_TOWN.buildings.find(
      (building) => building.buildingTypeCode === 'road',
    )!
    const brokenBridgeTown = {
      ...MOCK_MY_TOWN,
      buildings: [
        ...MOCK_MY_TOWN.buildings,
        {
          ...road,
          id: 'broken-bridge-cell',
          anchorX: 60,
          anchorY: 50,
          roadStructureId: 'broken-bridge',
          roadVariant: 'bridge_horizontal' as const,
        },
      ],
    }
    const api = createMockTownApi({ latencyMs: 0, initialTown: brokenBridgeTown })

    expect(
      await api.deleteRoad({
        buildingId: 'broken-bridge-cell',
        requestId: 'delete-broken-bridge',
      }),
    ).toMatchObject({ ok: false, error: { code: 'BRIDGE_GROUP_INVALID' } })
    expect(
      await api.deleteRoad({
        buildingId: 'mock-house-001',
        requestId: 'delete-house-via-road-api',
      }),
    ).toMatchObject({ ok: false, error: { code: 'DELETE_NOT_ALLOWED' } })
    expect(
      api
        .getTownSnapshot()
        .buildings.some((building) => building.id === 'broken-bridge-cell'),
    ).toBe(true)
  })

  it('rejects moving roads', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    expect(
      await api.moveBuilding({
        buildingId: 'mock-road-001',
        anchorX: 42,
        anchorY: 51,
        requestId: 'move-road',
      }),
    ).toMatchObject({ ok: false, error: { code: 'PLACEMENT_IMMOVABLE' } })
  })
})

describe('createMockTownApi land unlock', () => {
  it('deducts coins and appends one adjacent 20 by 20 area idempotently', async () => {
    const api = createMockTownApi({
      latencyMs: 0,
      initialTown: {
        ...MOCK_MY_TOWN,
        town: { ...MOCK_MY_TOWN.town, coins: 2_000 },
      },
    })
    const input = { x: 20, y: 40, requestId: 'unlock-request-1' }

    const first = await api.unlockLand(input)
    expect(first).toMatchObject({
      ok: true,
      data: {
        unlockedArea: { x: 20, y: 40, width: 20, height: 20 },
        coinBalance: 1000,
      },
    })

    const repeated = await api.unlockLand(input)
    expect(repeated).toEqual(first)
    expect(api.getTownSnapshot().town.coins).toBe(1000)
    expect(api.getTownSnapshot().unlockedAreas).toHaveLength(2)
  })

  it('rejects diagonal and already unlocked blocks', async () => {
    const api = createMockTownApi({
      latencyMs: 0,
      initialTown: {
        ...MOCK_MY_TOWN,
        town: { ...MOCK_MY_TOWN.town, coins: 3_000 },
      },
    })

    expect(
      await api.unlockLand({ x: 20, y: 20, requestId: 'diagonal' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'AREA_NOT_ADJACENT' },
    })
    expect(
      await api.unlockLand({ x: 40, y: 40, requestId: 'opened' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'AREA_ALREADY_UNLOCKED' },
    })
  })
})
