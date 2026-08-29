import { describe, expect, it } from 'vitest'
import { MOCK_BUILDING_CATALOG, MOCK_MY_TOWN } from '../../../mocks/data/towns'
import {
  classifyBridgeLine,
  evaluateRoadLinePreview,
  getRoadLineCells,
} from './road-line'

const road = MOCK_BUILDING_CATALOG.find((item) => item.code === 'road')!
const townWithAllLandUnlocked = {
  ...MOCK_MY_TOWN,
  town: { ...MOCK_MY_TOWN.town, coins: 10_000 },
  buildings: [],
  unlockedAreas: [{ x: 0, y: 0, width: 100, height: 100 }],
}

describe('getRoadLineCells', () => {
  it('snaps a diagonal drag to its dominant horizontal axis', () => {
    expect(getRoadLineCells({ x: 41, y: 52 }, { x: 45, y: 53 })).toEqual([
      { x: 41, y: 52 },
      { x: 42, y: 52 },
      { x: 43, y: 52 },
      { x: 44, y: 52 },
      { x: 45, y: 52 },
    ])
  })

  it('creates a vertical line in either drag direction', () => {
    expect(getRoadLineCells({ x: 52, y: 45 }, { x: 52, y: 42 })).toEqual([
      { x: 52, y: 42 },
      { x: 52, y: 43 },
      { x: 52, y: 44 },
      { x: 52, y: 45 },
    ])
  })
})

describe('evaluateRoadLinePreview', () => {
  it('allows a line to cross existing roads without repurchasing them', () => {
    const cells = getRoadLineCells({ x: 41, y: 50 }, { x: 49, y: 50 })
    const preview = evaluateRoadLinePreview({
      town: MOCK_MY_TOWN,
      catalog: MOCK_BUILDING_CATALOG,
      item: road,
      cells,
    })

    expect(preview.status).toEqual({ status: 'valid' })
    expect(preview.newCells).toEqual([
      { x: 41, y: 50 },
      { x: 49, y: 50 },
    ])
  })

  it('rejects a line that crosses a non-road building', () => {
    const preview = evaluateRoadLinePreview({
      town: MOCK_MY_TOWN,
      catalog: MOCK_BUILDING_CATALOG,
      item: road,
      cells: getRoadLineCells({ x: 41, y: 49 }, { x: 45, y: 49 }),
    })

    expect(preview.status).toEqual({
      status: 'invalid',
      reason: 'CELL_OCCUPIED',
    })
  })

  it('turns a complete perpendicular river crossing into a bridge', () => {
    const cells = getRoadLineCells({ x: 64, y: 55 }, { x: 70, y: 55 })
    const preview = evaluateRoadLinePreview({
      town: townWithAllLandUnlocked,
      catalog: MOCK_BUILDING_CATALOG,
      item: road,
      cells,
    })

    expect(preview).toMatchObject({
      cells,
      newCells: cells,
      placementKind: 'bridge',
      bridgeOrientation: 'horizontal',
      riverCells: getRoadLineCells({ x: 65, y: 55 }, { x: 69, y: 55 }),
      approachCells: [
        { x: 64, y: 55 },
        { x: 70, y: 55 },
      ],
      totalCostCoins: 1_000,
      status: { status: 'valid' },
    })
  })

  it('creates a vertical bridge across a horizontal river segment', () => {
    const cells = getRoadLineCells({ x: 80, y: 19 }, { x: 80, y: 25 })

    expect(
      classifyBridgeLine(cells, townWithAllLandUnlocked.mapLayout),
    ).toMatchObject({
      kind: 'bridge',
      orientation: 'vertical',
      riverCells: getRoadLineCells({ x: 80, y: 20 }, { x: 80, y: 24 }),
    })
  })

  it.each([
    [
      'an incomplete span',
      getRoadLineCells({ x: 64, y: 55 }, { x: 69, y: 55 }),
      'BRIDGE_SPAN_REQUIRED',
    ],
    [
      'a line parallel to the river',
      getRoadLineCells({ x: 67, y: 30 }, { x: 67, y: 36 }),
      'BRIDGE_DIRECTION_INVALID',
    ],
    [
      'a crossing at a river corner',
      getRoadLineCells({ x: 64, y: 72 }, { x: 70, y: 72 }),
      'BRIDGE_CORNER_FORBIDDEN',
    ],
  ] as const)('rejects %s with %s', (_label, cells, reason) => {
    const preview = evaluateRoadLinePreview({
      town: townWithAllLandUnlocked,
      catalog: MOCK_BUILDING_CATALOG,
      item: road,
      cells: [...cells],
    })

    expect(preview).toMatchObject({
      placementKind: 'bridge',
      status: { status: 'invalid', reason },
    })
  })

  it('uses the configured bridge and road prices', () => {
    const paidRoad = { ...road, costCoins: 25 }
    const preview = evaluateRoadLinePreview({
      town: townWithAllLandUnlocked,
      catalog: [paidRoad],
      item: paidRoad,
      cells: getRoadLineCells({ x: 64, y: 55 }, { x: 70, y: 55 }),
    })

    expect(preview.totalCostCoins).toBe(1_050)
    expect(preview.status).toEqual({ status: 'valid' })
  })

  it('requires every bridge cell to be unoccupied', () => {
    const roadTemplate = MOCK_MY_TOWN.buildings.find(
      (building) => building.buildingTypeCode === 'road',
    )!
    const preview = evaluateRoadLinePreview({
      town: {
        ...townWithAllLandUnlocked,
        buildings: [
          { ...roadTemplate, id: 'approach-road', anchorX: 64, anchorY: 55 },
        ],
      },
      catalog: MOCK_BUILDING_CATALOG,
      item: road,
      cells: getRoadLineCells({ x: 64, y: 55 }, { x: 70, y: 55 }),
    })

    expect(preview.status).toEqual({
      status: 'invalid',
      reason: 'CELL_OCCUPIED',
    })
  })
})
