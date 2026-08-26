// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mockGoogleIntegrationApi } from '../features/auth/api'
import { mockRankingApi, mockTownApi } from '../mocks/services'
import { paths } from './paths'
import { AppRoutes } from './router'

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockGoogleIntegrationApi.reset()
  mockRankingApi.reset()
  mockTownApi.reset()
})

afterEach(cleanup)

describe('paths', () => {
  it('encodes user IDs in one centralized path helper', () => {
    expect(paths.user('user/with space')).toBe('/users/user%2Fwith%20space')
  })
})

describe('AppRoutes', () => {
  it('redirects an unauthenticated ranking request to login', async () => {
    renderRoute(paths.ranking)

    expect(
      await screen.findByRole('heading', {
        name: /今日の一歩から、街づくりを始めよう。/,
      }),
    ).not.toBeNull()
  })

  it('shows the ranking to an authenticated user', async () => {
    await mockGoogleIntegrationApi.signInWithGoogle()
    renderRoute(paths.ranking)

    expect(
      await screen.findByRole('heading', { name: '人口ランキング' }),
    ).not.toBeNull()
    await waitFor(() =>
      expect(screen.getAllByRole('listitem')).toHaveLength(20),
    )
  })

  it('shows the read-only town map at the authenticated root route', async () => {
    await mockGoogleIntegrationApi.signInWithGoogle()
    renderRoute(paths.root)

    expect(
      await screen.findByRole('heading', { name: 'グリーンタウン' }),
    ).not.toBeNull()
    expect(
      screen.getByRole('application', { name: /グリーンタウンのマップ/ }),
    ).not.toBeNull()
    expect(screen.queryByRole('button', { name: /配置/ })).toBeNull()
  })

  it('shows the town button after Health connection and opens My Town', async () => {
    renderRoute(paths.login)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Googleで続ける' }),
    )
    const connectButton = await screen.findByRole('button', {
      name: 'Google Healthと連携する',
    })

    expect(
      screen.queryByRole('link', { name: /自分の街を見る/ }),
    ).toBeNull()

    fireEvent.click(connectButton)

    const townLink = await screen.findByRole('link', {
      name: /自分の街を見る/,
    })
    expect(townLink.getAttribute('href')).toBe(paths.root)

    fireEvent.click(townLink)

    expect(
      await screen.findByRole('heading', { name: 'グリーンタウン' }),
    ).not.toBeNull()
    expect(
      screen.getByRole('application', { name: /グリーンタウンのマップ/ }),
    ).not.toBeNull()
  })

  it('opens ranking over the town map instead of replacing it', async () => {
    await mockGoogleIntegrationApi.signInWithGoogle()
    renderRoute(paths.root)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    fireEvent.click(screen.getByRole('button', { name: /ランキング/ }))

    expect(
      await screen.findByRole('heading', { name: '人口ランキング' }),
    ).not.toBeNull()
    expect(
      screen.getByRole('application', { name: /グリーンタウンのマップ/ }),
    ).not.toBeNull()
  })

  it('navigates from a ranking item to the placeholder user page', async () => {
    await mockGoogleIntegrationApi.signInWithGoogle()
    renderRoute(paths.ranking)

    const firstRankingLink = await screen.findByRole('link', {
      name: /^1位、/,
    })
    fireEvent.click(firstRankingLink)

    expect(
      await screen.findByRole('heading', {
        name: 'ユーザーページは準備中です',
      }),
    ).not.toBeNull()
    expect(screen.getByText('mock-ranking-user-001')).not.toBeNull()
  })

  it('shows a not-found page for an undefined route', () => {
    renderRoute('/missing-page')

    expect(
      screen.getByRole('heading', { name: 'ページが見つかりません' }),
    ).not.toBeNull()
  })

  it('allows retry when session restoration fails', async () => {
    mockGoogleIntegrationApi.setFailure('getState', 'INTERNAL_ERROR')
    renderRoute(paths.ranking)

    expect(
      await screen.findByRole('heading', {
        name: 'ログイン状態を確認できませんでした',
      }),
    ).not.toBeNull()

    mockGoogleIntegrationApi.setFailure('getState', null)
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))

    expect(
      await screen.findByRole('heading', {
        name: /今日の一歩から、街づくりを始めよう。/,
      }),
    ).not.toBeNull()
  })
})
