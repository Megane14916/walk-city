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
  MOCK_PUBLIC_TOWN,
  MOCK_PUBLIC_USER_ID,
} from '../../../mocks/data/towns'
import {
  createMockGoogleIntegrationApi,
  createMockStepSyncApi,
  createMockWalkCityStore,
} from '../../../mocks/services'
import { createMockTownApi } from '../../../mocks/services/town'
import { evaluateRoadLinePreview, getRoadLineCells } from '../utils'
import { TownMap } from './TownMap'
import { TownOverview } from './TownOverview'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('TownMap', () => {
  it.each([
    ['my town', MOCK_MY_TOWN],
    ['public town', MOCK_PUBLIC_TOWN],
  ])('renders the fixed river in %s', (_label, town) => {
    const { container } = render(
      <TownMap town={town} catalog={MOCK_BUILDING_CATALOG} />,
    )

    expect(screen.getByRole('img', { name: '固定地形の川' })).not.toBeNull()
    expect(container.querySelectorAll('[data-terrain-code]')).toHaveLength(5)
  })

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

  it('renders a saved bridge with a dedicated horizontal illustration', () => {
    const roadTemplate = MOCK_MY_TOWN.buildings.find(
      (building) => building.buildingTypeCode === 'road',
    )!
    const bridgeCells = getRoadLineCells({ x: 64, y: 55 }, { x: 70, y: 55 })
    const townWithBridge = {
      ...MOCK_MY_TOWN,
      unlockedAreas: [
        ...MOCK_MY_TOWN.unlockedAreas,
        { x: 60, y: 40, width: 20, height: 20 },
      ],
      buildings: [
        ...MOCK_MY_TOWN.buildings,
        ...bridgeCells.map((cell, index) => ({
          ...roadTemplate,
          id: `bridge-cell-${index}`,
          anchorX: cell.x,
          anchorY: cell.y,
          roadStructureId: 'bridge-001',
          roadVariant: 'bridge_horizontal' as const,
        })),
      ],
    }

    render(
      <TownMap town={townWithBridge} catalog={MOCK_BUILDING_CATALOG} />,
    )

    expect(
      screen.getAllByRole('img', { name: /^橋（横向き）、/ }),
    ).toHaveLength(7)
  })

  it('highlights all seven cells when one bridge cell is selected', () => {
    const roadTemplate = MOCK_MY_TOWN.buildings.find(
      (building) => building.buildingTypeCode === 'road',
    )!
    const bridgeCells = getRoadLineCells({ x: 64, y: 55 }, { x: 70, y: 55 })
    const bridgeBuildings = bridgeCells.map((cell, index) => ({
      ...roadTemplate,
      id: `selected-bridge-cell-${index}`,
      anchorX: cell.x,
      anchorY: cell.y,
      roadStructureId: 'selected-bridge',
      roadVariant: 'bridge_horizontal' as const,
    }))

    render(
      <TownMap
        town={{
          ...MOCK_MY_TOWN,
          buildings: [...MOCK_MY_TOWN.buildings, ...bridgeBuildings],
        }}
        catalog={MOCK_BUILDING_CATALOG}
        selectedBuildingId="selected-bridge-cell-3"
      />,
    )

    expect(
      screen
        .getAllByRole('img', { name: /^橋（横向き）、/ })
        .every((element) => element.className.includes('ring-4')),
    ).toBe(true)
  })

  it('shows a valid bridge preview differently from a normal road line', () => {
    const road = MOCK_BUILDING_CATALOG.find((item) => item.code === 'road')!
    const cells = getRoadLineCells({ x: 64, y: 55 }, { x: 70, y: 55 })
    const town = {
      ...MOCK_MY_TOWN,
      unlockedAreas: [
        ...MOCK_MY_TOWN.unlockedAreas,
        { x: 60, y: 40, width: 20, height: 20 },
      ],
    }
    const preview = evaluateRoadLinePreview({
      town,
      catalog: MOCK_BUILDING_CATALOG,
      item: road,
      cells,
    })

    render(
      <TownMap
        town={town}
        catalog={MOCK_BUILDING_CATALOG}
        roadPlacement={{ item: road, cells, preview, onSelectCells: vi.fn() }}
      />,
    )

    expect(
      screen.getByRole('img', {
        name: '橋プレビュー、7マス、配置可能',
      }),
    ).not.toBeNull()
  })

  it('falls back safely when a building type is unknown', () => {
    render(<TownMap town={MOCK_MY_TOWN} catalog={[]} />)

    expect(
      screen.getByRole('img', { name: /^不明な建物（small_house）、/ }),
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
    expect(screen.getByText('10,000')).not.toBeNull()
    const menu = screen.getByRole('navigation', {
      name: 'ユーザーダッシュボード',
    })
    expect(within(menu).getByText('Walk City テストユーザー')).not.toBeNull()
    expect(within(menu).getByRole('button', { name: /ランキング/ })).not.toBeNull()
    expect(within(menu).getByRole('button', { name: /マーケット/ })).not.toBeNull()
    expect(within(menu).getByText('人口')).not.toBeNull()
    expect(within(menu).getByText('60人')).not.toBeNull()
    expect(within(menu).getByText('今日の歩数')).not.toBeNull()
    expect(within(menu).getByText('所持コイン数')).not.toBeNull()
    expect(screen.getByText('開放済み')).not.toBeNull()
    expect(screen.getByText('未開放')).not.toBeNull()
    expect(screen.getByText('道路')).not.toBeNull()
    expect(screen.getByText('建物')).not.toBeNull()
    expect(screen.getByText('川')).not.toBeNull()
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
    const menu = screen.getByRole('navigation', {
      name: 'ユーザーダッシュボード',
    })
    expect(within(menu).getByText('60人')).not.toBeNull()

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
    expect(screen.getByText('9,950')).not.toBeNull()
    expect(within(menu).getByText('70人')).not.toBeNull()
    expect(api.getTownSnapshot().town.population).toBe(70)
    expect(api.getTownSnapshot().buildings.at(-1)).toMatchObject({
      buildingTypeCode: 'small_house',
      anchorX: 41,
      anchorY: 50,
    })
  })

  it('prevents duplicate placement submissions while a request is pending', async () => {
    const api = createMockTownApi({ latencyMs: 50 })
    const placeBuilding = vi.spyOn(api, 'placeBuilding')
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    fireEvent.click(screen.getByRole('button', { name: /マーケット/ }))
    fireEvent.click(screen.getByRole('button', { name: '住宅（小）を選択' }))
    fireEvent.click(
      screen.getByRole('application', { name: /グリーンタウンのマップ/ }),
      { clientX: 180, clientY: 290 },
    )

    const submit = screen.getByRole('button', {
      name: '50コインで購入・配置',
    })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(placeBuilding).toHaveBeenCalledTimes(1)
    await screen.findByText('住宅（小）を配置しました。')
    expect(api.getTownSnapshot().town.coins).toBe(9_950)
  })

  it('selects a building, shows its details, and changes its display name', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    const map = screen.getByRole('application', {
      name: /グリーンタウンのマップ/,
    })
    fireEvent.click(map, { clientX: 227, clientY: 267 })

    expect(
      screen.getByRole('heading', { name: '住宅（小）' }),
    ).not.toBeNull()
    expect(screen.getByText('+10人')).not.toBeNull()
    expect(screen.getByText('50コイン')).not.toBeNull()
    expect(screen.getByText('人口を10増やします')).not.toBeNull()

    const input = screen.getByRole('textbox', { name: '建物の表示名' })
    fireEvent.change(input, { target: { value: 'わが家' } })
    fireEvent.click(screen.getByRole('button', { name: '表示名を保存' }))

    expect(
      await screen.findByText('建物の表示名を変更しました。'),
    ).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'わが家' })).not.toBeNull()
    expect(
      screen.getByRole('img', { name: /^わが家、座標43,49/ }),
    ).not.toBeNull()
    expect(
      api
        .getTownSnapshot()
        .buildings.find((building) => building.id === 'mock-house-001')
        ?.customName,
    ).toBe('わが家')
    expect(api.getTownSnapshot().town.population).toBe(60)
    expect(api.getTownSnapshot().town.coins).toBe(10_000)

    fireEvent.click(screen.getByRole('button', { name: '初期名に戻す' }))
    expect(
      await screen.findByText('建物の表示名を初期名に戻しました。'),
    ).not.toBeNull()
    expect(
      screen.getByRole('heading', { name: '住宅（小）' }),
    ).not.toBeNull()
  })

  it('moves a selected building without changing coins or population', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    const map = screen.getByRole('application', {
      name: /グリーンタウンのマップ/,
    })
    fireEvent.click(map, { clientX: 227, clientY: 267 })
    fireEvent.click(
      screen.getByRole('button', { name: 'この建物を移動する' }),
    )

    expect(
      screen.getByRole('heading', { name: '住宅（小）を移動' }),
    ).not.toBeNull()
    expect(screen.getByText('マップ上の移動先を選んでください。')).not.toBeNull()

    fireEvent.click(map, { clientX: 180, clientY: 290 })
    expect(
      screen.getByRole('img', {
        name: /住宅（小）の移動プレビュー、座標41,50、配置可能/,
      }),
    ).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '移動を確定' }))

    expect(
      await screen.findByText('住宅（小）を移動しました。'),
    ).not.toBeNull()
    expect(api.getTownSnapshot().town.coins).toBe(10_000)
    expect(api.getTownSnapshot().town.population).toBe(60)
    expect(
      api
        .getTownSnapshot()
        .buildings.find((building) => building.id === 'mock-house-001'),
    ).toMatchObject({ anchorX: 41, anchorY: 50 })
  })

  it('hides only rename controls when the production API does not support them', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    Object.defineProperty(api, 'supportsBuildingRename', { value: false })
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    const map = screen.getByRole('application', {
      name: /グリーンタウンのマップ/,
    })
    fireEvent.click(map, { clientX: 227, clientY: 267 })

    expect(
      screen.queryByRole('textbox', { name: '建物の表示名' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'この建物を移動する' }),
    ).not.toBeNull()
  })

  it('does not submit a move when the current position is selected', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    const map = screen.getByRole('application', {
      name: /グリーンタウンのマップ/,
    })
    fireEvent.click(map, { clientX: 227, clientY: 267 })
    fireEvent.click(
      screen.getByRole('button', { name: 'この建物を移動する' }),
    )
    fireEvent.click(map, { clientX: 227, clientY: 267 })

    expect(
      screen.getByText('現在と同じ位置です。別の移動先を選んでください。'),
    ).not.toBeNull()
    expect(
      screen.getByRole('button', { name: '移動を確定' }).hasAttribute('disabled'),
    ).toBe(true)
    expect(api.getTownSnapshot().buildings.find(
      (building) => building.id === 'mock-house-001',
    )).toMatchObject({ anchorX: 43, anchorY: 49 })
  })

  it('keeps the move selection and allows retrying after an API error', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    const moveBuilding = vi.spyOn(api, 'moveBuilding')
    api.setFailure('moveBuilding', 'INTERNAL_ERROR')
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    const map = screen.getByRole('application', {
      name: /グリーンタウンのマップ/,
    })
    fireEvent.click(map, { clientX: 227, clientY: 267 })
    fireEvent.click(
      screen.getByRole('button', { name: 'この建物を移動する' }),
    )
    fireEvent.click(map, { clientX: 180, clientY: 290 })
    fireEvent.click(screen.getByRole('button', { name: '移動を確定' }))

    expect(await screen.findByRole('alert')).not.toBeNull()
    expect(
      screen.getByRole('heading', { name: '住宅（小）を移動' }),
    ).not.toBeNull()
    expect(api.getTownSnapshot().buildings.find(
      (building) => building.id === 'mock-house-001',
    )).toMatchObject({ anchorX: 43, anchorY: 49 })

    api.setFailure('moveBuilding', null)
    fireEvent.click(screen.getByRole('button', { name: '移動を確定' }))

    expect(
      await screen.findByText('住宅（小）を移動しました。'),
    ).not.toBeNull()
    expect(api.getTownSnapshot().buildings.find(
      (building) => building.id === 'mock-house-001',
    )).toMatchObject({ anchorX: 41, anchorY: 50 })
    expect(moveBuilding).toHaveBeenCalledTimes(2)
    expect(moveBuilding.mock.calls[1][0].requestId).toBe(
      moveBuilding.mock.calls[0][0].requestId,
    )
  })

  it('confirms and deletes one unused road cell without changing coins', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    const map = screen.getByRole('application', {
      name: /グリーンタウンのマップ/,
    })
    fireEvent.click(map, { clientX: 204, clientY: 290 })
    fireEvent.click(screen.getByRole('button', { name: '道路 1セルを削除' }))

    expect(
      screen.getByRole('heading', {
        name: '道路 1セルを削除しますか？',
      }),
    ).not.toBeNull()
    expect(
      screen.getByText('削除してもコインは返却されません。'),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '削除する' }))

    expect(await screen.findByText('道路 1セルを削除しました。')).not.toBeNull()
    expect(api.getTownSnapshot().town.coins).toBe(10_000)
    expect(
      api
        .getTownSnapshot()
        .buildings.some((building) => building.id === 'mock-road-001'),
    ).toBe(false)
  })

  it('keeps an in-use road and retries with the same deletion request', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    const deleteRoad = vi.spyOn(api, 'deleteRoad')
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    fireEvent.click(
      screen.getByRole('application', {
        name: /グリーンタウンのマップ/,
      }),
      { clientX: 227, clientY: 290 },
    )
    fireEvent.click(screen.getByRole('button', { name: '道路 1セルを削除' }))
    fireEvent.click(screen.getByRole('button', { name: '削除する' }))

    expect(
      await screen.findByText('建物が利用中の道路は削除できません。'),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '削除する' }))
    await waitFor(() => expect(deleteRoad).toHaveBeenCalledTimes(2))
    expect(deleteRoad.mock.calls[1][0].requestId).toBe(
      deleteRoad.mock.calls[0][0].requestId,
    )
    expect(
      api
        .getTownSnapshot()
        .buildings.some((building) => building.id === 'mock-road-002'),
    ).toBe(true)
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
    expect(screen.getByText('9,800')).not.toBeNull()
    expect(api.getTownSnapshot().town.population).toBe(110)
    expect(api.getTownSnapshot().buildings.at(-1)).toMatchObject({
      buildingTypeCode: 'apartment',
      anchorX: 40,
      anchorY: 49,
    })
  })

  it('places a park without changing population when no small house is adjacent', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    fireEvent.click(screen.getByRole('button', { name: /マーケット/ }))
    fireEvent.click(screen.getByRole('button', { name: '公園を選択' }))

    const map = screen.getByRole('application', {
      name: /グリーンタウンのマップ/,
    })
    fireEvent.click(map, { clientX: 180, clientY: 290 })

    expect(
      screen.getByRole('img', {
        name: /公園の配置プレビュー、座標41,50、配置可能/,
      }),
    ).not.toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: '150コインで購入・配置' }),
    )

    expect(await screen.findByText('公園を配置しました。')).not.toBeNull()
    expect(screen.getByText('9,850')).not.toBeNull()
    expect(api.getTownSnapshot().town.population).toBe(60)
    expect(api.getTownSnapshot().buildings.at(-1)).toMatchObject({
      buildingTypeCode: 'small_park',
      anchorX: 41,
      anchorY: 50,
    })
  })

  it('draws and purchases multiple road cells with one confirmation', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    fireEvent.click(screen.getByRole('button', { name: /マーケット/ }))
    fireEvent.click(screen.getByRole('button', { name: '道路を選択' }))

    expect(
      screen.getByRole('heading', { name: '道路を線で配置' }),
    ).not.toBeNull()

    const map = screen.getByRole('application', {
      name: /グリーンタウンのマップ/,
    })
    fireEvent.pointerDown(map, {
      pointerId: 1,
      clientX: 180,
      clientY: 325,
    })
    fireEvent.pointerMove(map, {
      pointerId: 1,
      clientX: 250,
      clientY: 325,
    })
    fireEvent.pointerUp(map, {
      pointerId: 1,
      clientX: 250,
      clientY: 325,
    })

    expect(
      screen.getByRole('img', {
        name: '道路の線プレビュー、4マス、配置可能',
      }),
    ).not.toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: '4マスを無料で配置' }),
    )

    expect(await screen.findByText('4マスの道路を配置しました。')).not.toBeNull()
    expect(
      api
        .getTownSnapshot()
        .buildings.filter((building) => building.buildingTypeCode === 'road'),
    ).toHaveLength(11)
  })

  it('purchases and unlocks a cardinally adjacent 20 by 20 block', async () => {
    const api = createMockTownApi({
      latencyMs: 0,
      initialTown: {
        ...MOCK_MY_TOWN,
        town: { ...MOCK_MY_TOWN.town, coins: 1_500 },
      },
    })
    render(<TownOverview api={api} />)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    fireEvent.click(screen.getByRole('button', { name: /マーケット/ }))
    fireEvent.click(
      screen.getByRole('button', {
        name: '未開放領域アンロックを選択',
      }),
    )

    expect(
      screen.getByRole('heading', { name: '未開放領域アンロック' }),
    ).not.toBeNull()

    const map = screen.getByRole('application', {
      name: /グリーンタウンのマップ/,
    })
    fireEvent.click(map, { clientX: 100, clientY: 280 })

    expect(
      screen.getByRole('img', {
        name: '未開放領域アンロックのプレビュー、座標20,40、開放可能',
      }),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '1,000コインで開放' }))

    expect(
      await screen.findByText('隣接する20×20区画を開放しました。'),
    ).not.toBeNull()
    const menu = screen.getByRole('navigation', {
      name: 'ユーザーダッシュボード',
    })
    expect(within(menu).getByText('500')).not.toBeNull()
    expect(api.getTownSnapshot().unlockedAreas).toContainEqual({
      x: 20,
      y: 40,
      width: 20,
      height: 20,
    })
  })

  it('shows today steps after Health is connected', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-25T10:00:00.000Z'))
    const api = createMockTownApi({ latencyMs: 0 })
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
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

  it('syncs steps and applies the server coin balance together', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fixedNow = new Date('2026-08-27T03:00:00.000Z')
    vi.setSystemTime(fixedNow)
    const store = createMockWalkCityStore({
      stepsByDate: { '2026-08-27': 6_500 },
    })
    const api = createMockTownApi({ latencyMs: 0, store })
    const stepSyncApi = createMockStepSyncApi({
      latencyMs: 0,
      now: () => fixedNow,
      store,
      coinsPerStep: 0.1,
    })
    const googleApi = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initiallyHealthConnected: true,
      stepsByDate: { '2026-08-27': 100 },
      now: () => fixedNow,
    })
    const integrationResult = await googleApi.getGoogleIntegrationState()
    if (!integrationResult.ok) throw new Error(integrationResult.error.message)

    render(
      <TownOverview
        api={api}
        googleApi={googleApi}
        googleIntegrationState={integrationResult.data}
        stepSyncApi={stepSyncApi}
      />,
    )
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    fireEvent.click(screen.getByRole('button', { name: '歩数を同期 ↻' }))

    expect(await screen.findByText('6,500歩')).not.toBeNull()
    expect(await screen.findByText('10,650')).not.toBeNull()
    expect(
      screen.getByText('6,500歩を同期し、650コイン獲得しました。'),
    ).not.toBeNull()
    expect(api.getTownSnapshot().town.coins).toBe(10_650)

    fireEvent.click(screen.getByRole('button', { name: '歩数を同期 ↻' }))
    expect(
      await screen.findByText(
        '歩数は最新です。新しく付与されたコインはありません。',
      ),
    ).not.toBeNull()
    expect(api.getTownSnapshot().town.coins).toBe(10_650)
  })

  it('shows a reconnection action for a permission error', async () => {
    const fixedNow = new Date('2026-08-27T03:00:00.000Z')
    const store = createMockWalkCityStore()
    const api = createMockTownApi({ latencyMs: 0, store })
    const stepSyncApi = createMockStepSyncApi({
      latencyMs: 0,
      now: () => fixedNow,
      store,
    })
    stepSyncApi.setFailure('HEALTH_PERMISSION_REQUIRED')
    const googleApi = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initiallyHealthConnected: true,
      now: () => fixedNow,
    })
    const integrationResult = await googleApi.getGoogleIntegrationState()
    if (!integrationResult.ok) throw new Error(integrationResult.error.message)

    render(
      <TownOverview
        api={api}
        googleApi={googleApi}
        googleIntegrationState={integrationResult.data}
        stepSyncApi={stepSyncApi}
        healthConnectionHref="/health/connect"
      />,
    )
    await screen.findByRole('heading', { name: 'グリーンタウン' })
    fireEvent.click(screen.getByRole('button', { name: '歩数を同期 ↻' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('歩数を読み取る権限が必要です。')).not.toBeNull()
    expect(
      within(alert).getByRole('link', { name: '再連携' }).getAttribute('href'),
    ).toBe('/health/connect')
    expect(api.getTownSnapshot().town.coins).toBe(10_000)
  })

  it('does not expose or invoke step sync in a public town', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    const syncSteps = vi.fn()

    render(
      <TownOverview
        api={api}
        stepSyncApi={{ syncSteps }}
        mode={{ type: 'public', userId: MOCK_PUBLIC_USER_ID }}
      />,
    )
    await screen.findByRole('heading', { name: 'ブルータウン' })

    expect(screen.queryByText('今日の歩数')).toBeNull()
    expect(screen.queryByText('所持コイン数')).toBeNull()
    expect(screen.queryByRole('button', { name: '歩数を同期 ↻' })).toBeNull()
    expect(screen.queryByRole('button', { name: /マーケット/ })).toBeNull()
    expect(
      screen
        .getByRole('link', { name: '自分の街に戻る' })
        .getAttribute('href'),
    ).toBe('/')
    expect(syncSteps).not.toHaveBeenCalled()
  })

  it('shows read-only building details in a public town', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    render(
      <TownOverview
        api={api}
        mode={{ type: 'public', userId: MOCK_PUBLIC_USER_ID }}
      />,
    )
    await screen.findByRole('heading', { name: 'ブルータウン' })

    const map = screen.getByRole('application', {
      name: /ブルータウンのマップ/,
    })
    fireEvent.click(map, { clientX: 297, clientY: 197 })

    expect(
      screen.getByRole('heading', { name: '住宅（小）' }),
    ).not.toBeNull()
    expect(screen.getByText('+10人')).not.toBeNull()
    expect(
      screen.queryByRole('textbox', { name: '建物の表示名' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: /削除/ })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'この建物を移動する' }),
    ).toBeNull()
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
