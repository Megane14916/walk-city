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
    expect(screen.getByRole('img', { name: /^住宅（小）、/ })).not.toBeNull()
    expect(screen.getByRole('img', { name: /^住宅（大）、/ })).not.toBeNull()
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

  it('connects the road illustration in all four directions at an intersection', () => {
    const roadTemplate = MOCK_MY_TOWN.buildings.find(
      (building) => building.buildingTypeCode === 'road',
    )!
    const townWithIntersection = {
      ...MOCK_MY_TOWN,
      buildings: [
        ...MOCK_MY_TOWN.buildings,
        {
          ...roadTemplate,
          id: 'intersection-road-up',
          anchorX: 45,
          anchorY: 49,
        },
        {
          ...roadTemplate,
          id: 'intersection-road-down',
          anchorX: 45,
          anchorY: 51,
        },
      ],
    }

    render(
      <TownMap town={townWithIntersection} catalog={MOCK_BUILDING_CATALOG} />,
    )

    expect(
      screen.getByRole('img', {
        name: '道路、座標45,50、上右下左に接続',
      }),
    ).not.toBeNull()
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
      screen.getByRole('heading', { name: 'マーケット' }),
    ).not.toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(
      screen.getByRole('application', { name: /グリーンタウンのマップ/ }),
    ).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'パネルを閉じる' }))
    expect(
      screen.queryByRole('heading', { name: 'マーケット' }),
    ).toBeNull()
  })

  it('selects a market item and purchases it after a valid map preview', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    fireEvent.click(screen.getByRole('button', { name: /マーケット/ }))
    fireEvent.click(screen.getByRole('button', { name: '住宅（小）を選択' }))

    expect(
      screen.getByRole('heading', { name: '住宅（小）を配置' }),
    ).not.toBeNull()

    const map = screen.getByRole('application', {
      name: /グリーンタウンのマップ/,
    })
    fireEvent.click(map, { clientX: 180, clientY: 290 })

    expect(
      screen.getByRole('img', {
        name: /住宅（小）の配置プレビュー、座標41,50、配置可能/,
      }),
    ).not.toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: '50コインで購入・配置' }),
    )

    expect(
      await screen.findByText('住宅（小）を配置しました。'),
    ).not.toBeNull()
    expect(screen.getByText('450')).not.toBeNull()
    expect(api.getTownSnapshot().town.population).toBe(60)
    expect(api.getTownSnapshot().buildings.at(-1)).toMatchObject({
      buildingTypeCode: 'house-small',
      anchorX: 41,
      anchorY: 50,
    })
  })

  it('purchases a large house for 200 coins and increases population by 50', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    fireEvent.click(screen.getByRole('button', { name: /マーケット/ }))
    fireEvent.click(screen.getByRole('button', { name: '住宅（大）を選択' }))

    const map = screen.getByRole('application', {
      name: /グリーンタウンのマップ/,
    })
    fireEvent.click(map, { clientX: 157, clientY: 267 })

    expect(
      screen.getByRole('img', {
        name: /住宅（大）の配置プレビュー、座標40,49、配置可能/,
      }),
    ).not.toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: '200コインで購入・配置' }),
    )

    expect(
      await screen.findByText('住宅（大）を配置しました。'),
    ).not.toBeNull()
    expect(screen.getByText('300')).not.toBeNull()
    expect(api.getTownSnapshot().town.population).toBe(100)
    expect(api.getTownSnapshot().buildings.at(-1)).toMatchObject({
      buildingTypeCode: 'apartment',
      anchorX: 40,
      anchorY: 49,
    })
  })

  it('shows today steps after Health is connected', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-25T10:00:00.000Z'))
    const api = createMockTownApi({ latencyMs: 0 })
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const googleApi = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initiallyHealthConnected: true,
      stepsByDate: { [today]: 6500 },
      now: () => new Date('2026-08-25T10:00:00.000Z'),
    })
    const integrationResult = await googleApi.getGoogleIntegrationState()
    if (!integrationResult.ok) throw new Error(integrationResult.error.message)

    render(
      <TownOverview
        api={api}
        googleApi={googleApi}
        googleIntegrationState={integrationResult.data}
      />,
    )

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
