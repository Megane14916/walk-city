// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MOCK_BUILDING_CATALOG } from '../../../mocks/data/towns'
import type { RoadLinePreview } from '../../town/types'
import { getRoadLineCells } from '../../town/utils'
import { RoadPlacementControls } from './RoadPlacementControls'

afterEach(cleanup)

const road = MOCK_BUILDING_CATALOG.find((item) => item.code === 'road')!
const cells = getRoadLineCells({ x: 64, y: 55 }, { x: 70, y: 55 })
const bridgePreview: RoadLinePreview = {
  cells,
  newCells: cells,
  placementKind: 'bridge',
  bridgeOrientation: 'horizontal',
  riverCells: getRoadLineCells({ x: 65, y: 55 }, { x: 69, y: 55 }),
  approachCells: [
    { x: 64, y: 55 },
    { x: 70, y: 55 },
  ],
  totalCostCoins: 1_000,
  status: { status: 'valid' },
}

describe('RoadPlacementControls bridge preview', () => {
  it('shows the bridge composition, price, and build action', () => {
    render(
      <RoadPlacementControls
        item={road}
        preview={bridgePreview}
        isSubmitting={false}
        errorMessage={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByText('橋建設モード')).not.toBeNull()
    expect(screen.getByRole('heading', { name: '橋を配置' })).not.toBeNull()
    expect(
      screen.getByText(
        '橋5マスと両岸の進入道路2マスを建設できます。合計1,000コインです。',
      ),
    ).not.toBeNull()
    expect(
      (screen.getByRole('button', {
        name: '1,000コインで橋を建設',
      }) as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it('explains an incomplete bridge span and disables confirmation', () => {
    render(
      <RoadPlacementControls
        item={road}
        preview={{
          ...bridgePreview,
          newCells: [],
          riverCells: [],
          approachCells: [],
          totalCostCoins: 0,
          status: { status: 'invalid', reason: 'BRIDGE_SPAN_REQUIRED' },
        }}
        isSubmitting={false}
        errorMessage={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(
      screen.getByText('両岸を含む7マスを一度に選んでください。'),
    ).not.toBeNull()
    expect(
      (screen.getByRole('button', {
        name: '橋を建設',
      }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})
