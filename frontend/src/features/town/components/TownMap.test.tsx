// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MOCK_BUILDING_CATALOG,
  MOCK_MY_TOWN,
} from '../../../mocks/data/towns'
import { createMockGoogleIntegrationApi } from '../../../mocks/services'
import { createMockTownApi } from '../../../mocks/services/town'
import { TownMap } from './TownMap'
import { TownOverview } from './TownOverview'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('TownMap', () => {
  it('renders placed roads and buildings with accessible names', () => {
    render(
      <TownMap town={MOCK_MY_TOWN} catalog={MOCK_BUILDING_CATALOG} />,
    )

    expect(
      screen.getByRole('application', { name: /グリーンタウンのマップ/ }),
    ).not.toBeNull()
    expect(screen.getAllByRole('img', { name: /^道路、/ })).toHaveLength(7)
    expect(screen.getByRole('img', { name: /^小さな家、/ })).not.toBeNull()
    expect(screen.getByRole('img', { name: /^アパート、/ })).not.toBeNull()
  })

  it('provides button controls and updates the zoom label', () => {
    render(
      <TownMap town={MOCK_MY_TOWN} catalog={MOCK_BUILDING_CATALOG} />,
    )

    expect(screen.getByText('73%')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '拡大' }))
    expect(screen.getByText('87%')).not.toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: '開放エリアを中央に戻す' }),
    )
    expect(screen.getByText('73%')).not.toBeNull()
  })

  it('falls back safely when a building type is unknown', () => {
    render(<TownMap town={MOCK_MY_TOWN} catalog={[]} />)

    expect(
      screen.getByRole('img', { name: /^不明な建物（house-small）、/ }),
    ).not.toBeNull()
  })
})

describe('TownOverview', () => {
  it('loads the town and catalog together', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    render(<TownOverview api={api} />)

    expect(screen.getByRole('status', { name: '街を読み込み中' })).not.toBeNull()
    expect(
      await screen.findByRole('heading', { name: 'グリーンタウン' }),
    ).not.toBeNull()
    expect(screen.getByText('500')).not.toBeNull()
    const menu = screen.getByRole('navigation', {
      name: 'ユーザーダッシュボード',
    })
    expect(within(menu).getByText('Walk City テストユーザー')).not.toBeNull()
    expect(within(menu).getByRole('button', { name: /ランキング/ })).not.toBeNull()
    expect(within(menu).getByRole('button', { name: /マーケット/ })).not.toBeNull()
    expect(within(menu).getByText('今日の歩数')).not.toBeNull()
    expect(within(menu).getByText('所持コイン数')).not.toBeNull()
  })

  it('keeps the map visible while the market panel is open', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    fireEvent.click(screen.getByRole('button', { name: /マーケット/ }))

    expect(
      screen.getByRole('heading', { name: 'マーケットは準備中です' }),
    ).not.toBeNull()
    expect(
      screen.getByRole('application', { name: /グリーンタウンのマップ/ }),
    ).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'パネルを閉じる' }))
    expect(
      screen.queryByRole('heading', { name: 'マーケットは準備中です' }),
    ).toBeNull()
  })

  it('shows today steps after Health is connected', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-25T10:00:00.000Z'))
    const api = createMockTownApi({ latencyMs: 0 })
    const googleApi = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initiallyHealthConnected: true,
      stepsByDate: { '2026-08-25': 6500 },
      now: () => new Date('2026-08-25T10:00:00.000Z'),
    })
    render(<TownOverview api={api} googleApi={googleApi} />)

    expect(await screen.findByText('6,500歩')).not.toBeNull()
  })

  it('can retry after an API error', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    api.setFailure('getMyTown', 'INTERNAL_ERROR')
    render(<TownOverview api={api} />)

    expect(
      await screen.findByRole('heading', { name: '街を読み込めませんでした' }),
    ).not.toBeNull()

    api.setFailure('getMyTown', null)
    fireEvent.click(screen.getByRole('button', { name: 'もう一度試す' }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'グリーンタウン' })).not.toBeNull(),
    )
  })
})
