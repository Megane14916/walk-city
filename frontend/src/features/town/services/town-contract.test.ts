import { describe, expect, it } from 'vitest'
import {
  MOCK_BUILDING_CATALOG,
  MOCK_MY_TOWN,
  MOCK_PUBLIC_TOWN,
} from '../../../mocks/data/towns'
import {
  isBuildingCatalog,
  isBuildingCatalogItem,
  isTownDetail,
} from './town-contract'

describe('Town Supabase contract validators', () => {
  it('accepts the current catalog contract', () => {
    expect(isBuildingCatalog(MOCK_BUILDING_CATALOG)).toBe(true)
    expect(isBuildingCatalogItem(MOCK_BUILDING_CATALOG[0])).toBe(true)
  })

  it('rejects unsafe catalog numbers', () => {
    expect(
      isBuildingCatalogItem({
        ...MOCK_BUILDING_CATALOG[0],
        costCoins: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toBe(false)
  })

  it('accepts self and public town contracts', () => {
    expect(isTownDetail(MOCK_MY_TOWN)).toBe(true)
    expect(isTownDetail(MOCK_PUBLIC_TOWN)).toBe(true)
  })

  it('rejects a public town with an invalid editable value', () => {
    expect(
      isTownDetail({
        ...MOCK_PUBLIC_TOWN,
        editable: 'false',
      }),
    ).toBe(false)
  })

  it('rejects malformed placed-building timestamps', () => {
    expect(
      isTownDetail({
        ...MOCK_MY_TOWN,
        buildings: [
          {
            ...MOCK_MY_TOWN.buildings[0],
            updatedAt: 'yesterday',
          },
        ],
      }),
    ).toBe(false)
  })
})
