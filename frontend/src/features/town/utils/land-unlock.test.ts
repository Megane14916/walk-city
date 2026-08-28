import { describe, expect, it } from 'vitest'
import { MOCK_MY_TOWN } from '../../../mocks/data/towns'
import type { TownDetail, UnlockedArea } from '../types'
import {
  evaluateLandUnlockPreview,
  getLandUnlockAreaForCell,
} from './land-unlock'

function createTown(coins = 1_000): TownDetail {
  return {
    ...MOCK_MY_TOWN,
    town: { ...MOCK_MY_TOWN.town, coins },
    unlockedAreas: MOCK_MY_TOWN.unlockedAreas.map((area) => ({ ...area })),
  }
}

describe('land unlock rules', () => {
  it('aligns a selected cell to its 20 by 20 block', () => {
    expect(getLandUnlockAreaForCell({ x: 39, y: 59 })).toEqual({
      x: 20,
      y: 40,
      width: 20,
      height: 20,
    })
  })

  it.each<UnlockedArea>([
    { x: 40, y: 20, width: 20, height: 20 },
    { x: 40, y: 60, width: 20, height: 20 },
    { x: 20, y: 40, width: 20, height: 20 },
    { x: 60, y: 40, width: 20, height: 20 },
  ])('allows a cardinally adjacent block: $x,$y', (area) => {
    expect(evaluateLandUnlockPreview({ town: createTown(), area })).toEqual({
      status: 'valid',
    })
  })

  it('rejects a diagonal block', () => {
    expect(
      evaluateLandUnlockPreview({
        town: createTown(),
        area: { x: 20, y: 20, width: 20, height: 20 },
      }),
    ).toEqual({ status: 'invalid', reason: 'AREA_NOT_ADJACENT' })
  })

  it('rejects an already unlocked block', () => {
    expect(
      evaluateLandUnlockPreview({
        town: createTown(),
        area: { x: 40, y: 40, width: 20, height: 20 },
      }),
    ).toEqual({ status: 'invalid', reason: 'AREA_ALREADY_UNLOCKED' })
  })

  it('rejects a block outside the map', () => {
    expect(
      evaluateLandUnlockPreview({
        town: createTown(),
        area: { x: -20, y: 40, width: 20, height: 20 },
      }),
    ).toEqual({ status: 'invalid', reason: 'OUT_OF_MAP' })
  })

  it('rejects an adjacent block when coins are insufficient', () => {
    expect(
      evaluateLandUnlockPreview({
        town: createTown(999),
        area: { x: 20, y: 40, width: 20, height: 20 },
      }),
    ).toEqual({ status: 'invalid', reason: 'INSUFFICIENT_COINS' })
  })
})
