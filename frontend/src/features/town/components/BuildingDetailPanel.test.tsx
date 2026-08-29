// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MOCK_BUILDING_CATALOG, MOCK_MY_TOWN } from '../../../mocks/data/towns'
import { BuildingDetailPanel } from './BuildingDetailPanel'

afterEach(cleanup)

const roadItem = MOCK_BUILDING_CATALOG.find((item) => item.code === 'road')!
const road = MOCK_MY_TOWN.buildings.find(
  (building) => building.id === 'mock-road-001',
)!

describe('BuildingDetailPanel road deletion', () => {
  it('shows a one-cell confirmation and supports cancellation', () => {
    const onDeleteRoad = vi.fn()
    render(
      <BuildingDetailPanel
        building={road}
        item={roadItem}
        editable
        isSaving={false}
        isDeleting={false}
        errorMessage={null}
        onClose={vi.fn()}
        onRename={vi.fn()}
        onDeleteRoad={onDeleteRoad}
      />,
    )

    expect(screen.getByText('道路と橋は移動できません。')).not.toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '道路 1セルを削除' }))
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onDeleteRoad).not.toHaveBeenCalled()
  })

  it('treats every bridge cell as a seven-cell deletion target', () => {
    const onDeleteRoad = vi.fn()
    render(
      <BuildingDetailPanel
        building={{
          ...road,
          roadStructureId: 'bridge-001',
          roadVariant: 'bridge_horizontal',
        }}
        item={roadItem}
        editable
        isSaving={false}
        isDeleting={false}
        errorMessage={null}
        onClose={vi.fn()}
        onRename={vi.fn()}
        onDeleteRoad={onDeleteRoad}
      />,
    )

    expect(screen.getByRole('heading', { name: '橋' })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '橋 7セルを削除' }))
    expect(
      screen.getByRole('heading', {
        name: '橋 7セルをまとめて削除しますか？',
      }),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '削除する' }))
    expect(onDeleteRoad).toHaveBeenCalledOnce()
  })

  it('does not expose deletion controls in read-only towns', () => {
    render(
      <BuildingDetailPanel
        building={road}
        item={roadItem}
        editable={false}
        isSaving={false}
        isDeleting={false}
        errorMessage={null}
        onClose={vi.fn()}
        onRename={vi.fn()}
        onDeleteRoad={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /削除/ })).toBeNull()
  })
})
