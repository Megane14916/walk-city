import { describe, expect, it } from 'vitest'
import { FIXED_MAP_LAYOUT } from '../../../mocks/data/map-layout'
import {
  createTerrainCellIndex,
  getTerrainAreaAtCell,
  hasTerrainCollision,
} from './map-terrain'

describe('fixed river terrain', () => {
  it('uses five non-overlapping areas for the agreed river shape', () => {
    expect(FIXED_MAP_LAYOUT.terrainAreas).toMatchObject([
      { x: 0, y: 70, width: 65, height: 5, bridgeable: true },
      { x: 65, y: 70, width: 5, height: 5, bridgeable: false },
      { x: 65, y: 25, width: 5, height: 45, bridgeable: true },
      { x: 65, y: 20, width: 5, height: 5, bridgeable: false },
      { x: 70, y: 20, width: 30, height: 5, bridgeable: true },
    ])

    const riverCells = createTerrainCellIndex(FIXED_MAP_LAYOUT, 'river')
    const rectangleCellCount = FIXED_MAP_LAYOUT.terrainAreas.reduce(
      (total, area) => total + area.width * area.height,
      0,
    )

    expect(riverCells.size).toBe(750)
    expect(rectangleCellCount).toBe(riverCells.size)
  })

  it('continues from the left edge, turns upward twice, and exits right', () => {
    const riverCells = createTerrainCellIndex(FIXED_MAP_LAYOUT, 'river')

    for (let x = 0; x <= 69; x += 1) {
      expect(riverCells.has(`${x}:70`)).toBe(true)
    }
    for (let y = 20; y <= 74; y += 1) {
      expect(riverCells.has(`65:${y}`)).toBe(true)
    }
    for (let x = 65; x <= 99; x += 1) {
      expect(riverCells.has(`${x}:20`)).toBe(true)
    }

    expect(riverCells.has('64:69')).toBe(false)
    expect(riverCells.has('70:25')).toBe(false)
  })

  it('finds river collisions and keeps corner segments non-bridgeable', () => {
    expect(
      hasTerrainCollision([{ x: 68, y: 50 }], FIXED_MAP_LAYOUT, 'river'),
    ).toBe(true)
    expect(
      hasTerrainCollision([{ x: 64, y: 50 }], FIXED_MAP_LAYOUT, 'river'),
    ).toBe(false)
    expect(
      getTerrainAreaAtCell(FIXED_MAP_LAYOUT, { x: 68, y: 72 }, 'river'),
    ).toMatchObject({ segmentKind: 'corner', bridgeable: false })
  })
})
