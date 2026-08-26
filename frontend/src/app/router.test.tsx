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
import {
  mockGoogleIntegrationApi,
  mockRankingApi,
  mockTownApi,
} from '../mocks/services'
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
      }, { timeout: 3000 }),
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
    mockGoogleIntegrationApi.setFailure(
      'getGoogleIntegrationState',
      'INTERNAL_ERROR',
    )
    renderRoute(paths.ranking)

    expect(
      await screen.findByRole('heading', {
        name: 'ログイン状態を確認できませんでした',
      }),
    ).not.toBeNull()

    mockGoogleIntegrationApi.setFailure('getGoogleIntegrationState', null)
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))

    expect(
      await screen.findByRole('heading', {
        name: /今日の一歩から、街づくりを始めよう。/,
      }),
    ).not.toBeNull()
  })
})
