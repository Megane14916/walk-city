import { describe, expect, it } from 'vitest'
import { MOCK_BUILDING_CATALOG, MOCK_MY_TOWN } from '../../../mocks/data/towns'
import { evaluateRoadLinePreview, getRoadLineCells } from './road-line'

const road = MOCK_BUILDING_CATALOG.find((item) => item.code === 'road')!

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
})
