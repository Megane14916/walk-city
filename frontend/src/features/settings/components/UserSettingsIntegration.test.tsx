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
import { MemoryRouter } from 'react-router-dom'
import { MOCK_PUBLIC_USER_ID } from '../../../mocks/data/towns'
import {
  createMockRankingApi,
  createMockSettingsApi,
  createMockTownApi,
  createMockWalkCityStore,
} from '../../../mocks/services'
import { TownOverview } from '../../town/components/TownOverview'

afterEach(() => cleanup())

describe('user settings in TownOverview', () => {
  it('places settings before ranking and applies saved names immediately', async () => {
    const store = createMockWalkCityStore()
    const townApi = createMockTownApi({ latencyMs: 0, store })
    const settingsApi = createMockSettingsApi({ latencyMs: 0, store })
    const rankingApi = createMockRankingApi({ latencyMs: 0, store })
    const refreshAuth = vi.fn().mockResolvedValue({ ok: true })
    render(
      <MemoryRouter>
        <TownOverview
          api={townApi}
          rankingApi={rankingApi}
          settingsApi={settingsApi}
          refreshAuth={refreshAuth}
        />
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: 'グリーンタウン' })
    const menu = screen.getByRole('navigation', {
      name: 'ユーザーダッシュボード',
    })
    const settingsButton = within(menu).getByRole('button', { name: '設定' })
    const rankingButton = within(menu).getByRole('button', { name: /ランキング/ })
    expect(
      settingsButton.compareDocumentPosition(rankingButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0)

    fireEvent.click(rankingButton)
    expect(await screen.findByRole('heading', { name: '人口ランキング' })).not.toBeNull()
    fireEvent.click(settingsButton)
    expect(screen.queryByRole('heading', { name: '人口ランキング' })).toBeNull()

    fireEvent.change(screen.getByLabelText('ユーザー名'), {
      target: { value: '新しい市長' },
    })
    fireEvent.change(screen.getByLabelText('街の名前'), {
      target: { value: 'ウォークシティ' },
    })
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))

    expect(
      await screen.findByRole('heading', { name: 'ウォークシティ' }),
    ).not.toBeNull()
    expect(within(menu).getByText('新しい市長')).not.toBeNull()
    expect((await screen.findByRole('status')).textContent).toContain(
      '設定を保存しました。',
    )
    await waitFor(() => expect(refreshAuth).toHaveBeenCalledTimes(1))
  }, 15_000)

  it('does not expose settings while visiting a public town', async () => {
    const store = createMockWalkCityStore()
    render(
      <MemoryRouter>
        <TownOverview
          api={createMockTownApi({ latencyMs: 0, store })}
          settingsApi={createMockSettingsApi({ latencyMs: 0, store })}
          mode={{ type: 'public', userId: MOCK_PUBLIC_USER_ID }}
        />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'ブルータウン' })
    expect(screen.queryByRole('button', { name: '設定' })).toBeNull()
  })
})
