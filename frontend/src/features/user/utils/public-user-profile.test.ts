import { describe, expect, it } from 'vitest'
import type { TownDetail } from '../../town/types'
import { toPublicUserProfile } from './public-user-profile'

const REQUESTED_USER_ID = 'public-user-001'

function createPublicTown(
  overrides: Partial<TownDetail> = {},
): TownDetail {
  return {
    town: {
      id: 'public-town-001',
      owner: {
        id: REQUESTED_USER_ID,
        displayName: '街歩きユーザー',
      },
      name: 'みどりの街',
      population: 12_345,
      mapWidth: 100,
      mapHeight: 100,
    },
    buildings: [],
    unlockedAreas: [],
    obstacles: [],
    catalogVersion: 1,
    editable: false,
    ...overrides,
  }
}

function expectContractError(result: ReturnType<typeof toPublicUserProfile>) {
  expect(result).toEqual({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'ユーザー情報を読み込めませんでした。',
    },
  })
}

describe('toPublicUserProfile', () => {
  it('extracts only the public profile summary from a public town', () => {
    const detail = createPublicTown({
      town: {
        ...createPublicTown().town,
        coins: 98_765,
      },
      buildings: [
        {
          id: 'building-001',
          buildingTypeCode: 'house-small',
          customName: null,
          anchorX: 40,
          anchorY: 40,
          createdAt: '2026-08-28T00:00:00.000Z',
          updatedAt: '2026-08-28T00:00:00.000Z',
        },
      ],
    })

    expect(toPublicUserProfile(REQUESTED_USER_ID, detail)).toEqual({
      ok: true,
      data: {
        id: REQUESTED_USER_ID,
        displayName: '街歩きユーザー',
        town: {
          id: 'public-town-001',
          name: 'みどりの街',
          population: 12_345,
        },
      },
    })
  })

  it('rejects a response owned by a different user', () => {
    const detail = createPublicTown({
      town: {
        ...createPublicTown().town,
        owner: {
          id: 'different-user',
          displayName: '別ユーザー',
        },
      },
    })

    expectContractError(toPublicUserProfile(REQUESTED_USER_ID, detail))
  })

  it('rejects an editable town response', () => {
    expectContractError(
      toPublicUserProfile(
        REQUESTED_USER_ID,
        createPublicTown({ editable: true }),
      ),
    )
  })

  it.each([
    ['an empty requested user ID', ''],
    ['a whitespace-only requested user ID', '   '],
  ])('rejects %s', (_label, requestedUserId) => {
    expectContractError(
      toPublicUserProfile(requestedUserId, createPublicTown()),
    )
  })

  it.each([
    ['display name', { displayName: '   ' }],
    ['owner ID', { id: '' }],
  ])('rejects an empty %s', (_label, ownerOverride) => {
    const detail = createPublicTown({
      town: {
        ...createPublicTown().town,
        owner: {
          ...createPublicTown().town.owner,
          ...ownerOverride,
        },
      },
    })

    expectContractError(toPublicUserProfile(REQUESTED_USER_ID, detail))
  })

  it.each([
    ['town ID', { id: '' }],
    ['town name', { name: '   ' }],
  ])('rejects an empty %s', (_label, townOverride) => {
    const detail = createPublicTown({
      town: {
        ...createPublicTown().town,
        ...townOverride,
      },
    })

    expectContractError(toPublicUserProfile(REQUESTED_USER_ID, detail))
  })

  it.each([
    ['a negative population', -1],
    ['a fractional population', 1.5],
    ['an infinite population', Number.POSITIVE_INFINITY],
    ['a NaN population', Number.NaN],
  ])('rejects %s', (_label, population) => {
    const detail = createPublicTown({
      town: {
        ...createPublicTown().town,
        population,
      },
    })

    expectContractError(toPublicUserProfile(REQUESTED_USER_ID, detail))
  })
})
