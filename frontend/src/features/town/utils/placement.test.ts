import { describe, expect, it } from 'vitest'
import { MOCK_BUILDING_CATALOG, MOCK_MY_TOWN } from '../../../mocks/data/towns'
import { evaluatePlacementPreview } from './placement'

const house = MOCK_BUILDING_CATALOG.find(
  (item) => item.code === 'small_house',
)!

const townWithRightBlockUnlocked = {
  ...MOCK_MY_TOWN,
  unlockedAreas: [
    ...MOCK_MY_TOWN.unlockedAreas,
    { x: 60, y: 40, width: 20, height: 20 },
  ],
}

describe('evaluatePlacementPreview fixed terrain', () => {
  it.each(['place', 'move'] as const)(
    'rejects a %s preview on a river cell',
    (operation) => {
      expect(
        evaluatePlacementPreview({
          town: townWithRightBlockUnlocked,
          catalog: MOCK_BUILDING_CATALOG,
          item: house,
          anchor: { x: 68, y: 50 },
          operation,
        }),
      ).toEqual({ status: 'invalid', reason: 'RIVER_BLOCKED' })
    },
  )
})
