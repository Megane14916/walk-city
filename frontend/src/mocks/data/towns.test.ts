import { describe, expect, it } from 'vitest'
import {
  areCellsUnlocked,
  getPlacedBuildingCells,
} from '../../features/town/utils'
import {
  MOCK_BUILDING_CATALOG,
  MOCK_MY_TOWN,
  MOCK_PUBLIC_TOWN,
} from './towns'

describe('town map fixtures', () => {
  it.each([
    ['my town', MOCK_MY_TOWN],
    ['public town', MOCK_PUBLIC_TOWN],
  ])('starts %s with the centered 20 by 20 area', (_label, town) => {
    expect(town.unlockedAreas).toEqual([
      { x: 40, y: 40, width: 20, height: 20 },
    ])

    for (const building of town.buildings) {
      expect(
        areCellsUnlocked(
          getPlacedBuildingCells(building, MOCK_BUILDING_CATALOG),
          town.unlockedAreas,
        ),
      ).toBe(true)
    }
  })
})
