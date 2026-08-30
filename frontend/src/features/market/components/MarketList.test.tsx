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
    expect(
      within(rows[2]).getByText(
        '隣接する住宅（小）は人口+5、住宅（大）は人口+10（最大+40）',
      ),
    ).not.toBeNull()
    expect(
      within(rows[3]).getByText(
        '住宅（小）1軒につき人口+5、住宅（大）1軒につき人口+10',
      ),
    ).not.toBeNull()
    expect(within(rows[5]).getByText('人口を20人増加')).not.toBeNull()
    expect(
      within(rows[6]).getByText('上下左右に隣接する土地へ建物を配置可能'),
    ).not.toBeNull()
    expect(
      within(rows[7]).getByText(
        '住宅（小）1軒につき人口+20、住宅（大）1軒につき人口+30',
      ),
    ).not.toBeNull()
    expect(within(rows[9]).getByText('未開放領域アンロック')).not.toBeNull()
  })

  it('keeps unimplemented model effects empty while showing configured costs', () => {
    render(<MarketList items={MARKET_ITEMS} />)

    const rows = screen.getAllByRole('listitem')
    expect(within(rows[4]).queryByText(/人口/)).toBeNull()
    expect(within(rows[2]).getByText('150')).not.toBeNull()
    expect(within(rows[6]).getByText('0')).not.toBeNull()
    expect(within(rows[9]).getByText('20×20')).not.toBeNull()
  })

  it('allows only catalog-backed priced items to be selected', () => {
    const onSelectItem = vi.fn()
    render(
      <MarketList
        items={MARKET_ITEMS}
        purchasableItemCodes={new Set(['small_house', 'apartment', 'road'])}
        onSelectItem={onSelectItem}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '住宅（小）を選択' }))
    expect(onSelectItem).toHaveBeenCalledWith(MARKET_ITEMS[0])
    fireEvent.click(screen.getByRole('button', { name: '住宅（大）を選択' }))
    expect(onSelectItem).toHaveBeenCalledWith(MARKET_ITEMS[1])
    expect(
      screen.getByRole('button', { name: '公園は準備中' }).getAttribute(
        'aria-disabled',
      ),
    ).toBe('true')
  })

  it('allows every model to be selected when catalog-backed', () => {
    const modelCodes = [
      'small_park',
      'hospital',
      'commercial',
      'farm',
      'town_hall',
      'factory',
    ]
    render(
      <MarketList
        items={MARKET_ITEMS}
        purchasableItemCodes={new Set(modelCodes)}
        onSelectItem={() => undefined}
      />,
    )

    for (const item of MARKET_ITEMS.filter((candidate) =>
      modelCodes.includes(candidate.code),
    )) {
      expect(
        screen.getByRole('button', { name: `${item.name}を選択` }),
      ).not.toBeNull()
    }
  })
})
