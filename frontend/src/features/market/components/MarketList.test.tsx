// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MARKET_ITEMS } from '../data/market-items'
import { MarketList } from './MarketList'

afterEach(cleanup)

describe('MarketList', () => {
  it('shows every market item in the provided order', () => {
    render(<MarketList items={MARKET_ITEMS} />)

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(10)
    expect(within(rows[0]).getByText('住宅（小）')).not.toBeNull()
    expect(within(rows[1]).getByText('住宅（大）')).not.toBeNull()
    expect(within(rows[1]).getByText('人口を50人増加')).not.toBeNull()
    expect(within(rows[1]).getByText('200')).not.toBeNull()
    expect(within(rows[9]).getByText('未開放領域アンロック')).not.toBeNull()
  })

  it('keeps undecided effects empty while showing zero costs', () => {
    render(<MarketList items={MARKET_ITEMS} />)

    const rows = screen.getAllByRole('listitem')
    expect(within(rows[2]).queryByText(/人口/)).toBeNull()
    expect(within(rows[2]).getByText('0')).not.toBeNull()
    expect(within(rows[6]).getByText('0')).not.toBeNull()
    expect(within(rows[9]).getByText('20×20')).not.toBeNull()
  })

  it('allows only catalog-backed priced items to be selected', () => {
    const onSelectItem = vi.fn()
    render(
      <MarketList
        items={MARKET_ITEMS}
        purchasableItemCodes={new Set(['house-small', 'apartment', 'road'])}
        onSelectItem={onSelectItem}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '住宅（小）を選択' }))
    expect(onSelectItem).toHaveBeenCalledWith(MARKET_ITEMS[0])
    fireEvent.click(screen.getByRole('button', { name: '住宅（大）を選択' }))
    expect(onSelectItem).toHaveBeenCalledWith(MARKET_ITEMS[1])
    expect(
      screen.getByRole('button', { name: '公園（小）は準備中' }).getAttribute(
        'aria-disabled',
      ),
    ).toBe('true')
  })
})
