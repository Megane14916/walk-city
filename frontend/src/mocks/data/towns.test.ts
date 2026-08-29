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
import { MARKET_ITEMS } from '../../features/market/data/market-items'

describe('town map fixtures', () => {
  it('keeps every market model aligned with the building catalog', () => {
    const modelCodes = [
      'small_park',
      'hospital',
      'commercial',
      'farm',
      'town_hall',
      'factory',
    ]

    for (const code of modelCodes) {
      const marketItem = MARKET_ITEMS.find((item) => item.code === code)
      const catalogItem = MOCK_BUILDING_CATALOG.find(
        (item) => item.code === code,
      )

      expect(catalogItem).toMatchObject({
        code,
        costCoins: marketItem?.costCoins,
        width: marketItem?.width,
        height: marketItem?.height,
        enabled: true,
      })
    }
  })

  it.each([
    ['my town', MOCK_MY_TOWN],
    ['public town', MOCK_PUBLIC_TOWN],
  ])('starts %s with a population of 60', (_label, town) => {
    expect(town.town.population).toBe(60)
  })

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
