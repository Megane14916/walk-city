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
