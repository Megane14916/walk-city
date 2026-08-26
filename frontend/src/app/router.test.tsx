// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GoogleIntegrationApi } from '../features/auth/api'
import {
  createMockGoogleIntegrationApi,
  mockGoogleIntegrationApi,
  mockRankingApi,
  mockTownApi,
} from '../mocks/services'
import { paths } from './paths'
import { ApiProvider, AuthProvider } from './providers'
import { AppRoutes } from './router'

function renderRoute(
  path: string,
  googleIntegrationApi: GoogleIntegrationApi = mockGoogleIntegrationApi,
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ApiProvider services={{ googleIntegrationApi }}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ApiProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockGoogleIntegrationApi.reset()
  mockRankingApi.reset()
  mockTownApi.reset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('paths', () => {
  it('encodes user IDs in one centralized path helper', () => {
    expect(paths.user('user/with space')).toBe('/users/user%2Fwith%20space')
  })
})

describe('AppRoutes', () => {
  it('shows Health connection UI after Google login without double submission', async () => {
    const signInSpy = vi.spyOn(mockGoogleIntegrationApi, 'signInWithGoogle')
    renderRoute(paths.login)

    const loginButton = await screen.findByRole('button', {
      name: 'Googleで続ける',
    })
    fireEvent.click(loginButton)
    fireEvent.click(loginButton)

    expect(
      await screen.findByRole('heading', {
        name: /歩数を街の力に変えましょう。/,
      }),
    ).not.toBeNull()
    expect(signInSpy).toHaveBeenCalledTimes(1)
  })

  it('shows a retryable login error after OAuth cancellation', async () => {
    mockGoogleIntegrationApi.setFailure('signInWithGoogle', 'OAUTH_CANCELLED')
    renderRoute(paths.login)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Googleで続ける' }),
    )
    expect(
      await screen.findByText('Google認証がキャンセルされました。'),
    ).not.toBeNull()

    mockGoogleIntegrationApi.setFailure('signInWithGoogle', null)
    fireEvent.click(screen.getByRole('button', { name: 'Googleで続ける' }))

    expect(
      await screen.findByRole('heading', {
        name: /歩数を街の力に変えましょう。/,
      }),
    ).not.toBeNull()
  })

  it('redirects an authenticated login request to Health connection', async () => {
    await mockGoogleIntegrationApi.signInWithGoogle()
    renderRoute(paths.login)

    expect(
      await screen.findByRole('heading', {
        name: /歩数を街の力に変えましょう。/,
      }),
    ).not.toBeNull()
  })

  it('allows a user to skip Health connection and continue to town', async () => {
    const api = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
    })
    renderRoute(paths.healthConnect, api)

    fireEvent.click(
      await screen.findByRole('button', { name: '今は連携しない' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'グリーンタウン' }),
    ).not.toBeNull()
  })

  it('shows a re-consent action when Health permission is required', async () => {
    const api = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initialHealthConnectionStatus: 'permission_required',
    })
    renderRoute(paths.healthConnect, api)

    expect(
      await screen.findByRole('heading', {
        name: /歩数の読み取りを再許可してください。/,
      }),
    ).not.toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Google Healthを再連携する' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: /街づくりの準備ができました。/,
      }),
    ).not.toBeNull()
  })

  it('continues to town from the connected completion state', async () => {
    const api = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initiallyHealthConnected: true,
    })
    renderRoute(paths.healthConnect, api)

    fireEvent.click(
      await screen.findByRole('button', { name: '街づくりを始める' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'グリーンタウン' }),
    ).not.toBeNull()
  })

  it('confirms Health disconnection without signing the user out', async () => {
    const api = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initiallyHealthConnected: true,
    })
    renderRoute(paths.healthConnect, api)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Google Healthの連携を解除',
      }),
    )
    expect(
      screen.getByRole('alertdialog', {
        name: 'Google Health連携の解除確認',
      }),
    ).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()

    fireEvent.click(
      screen.getByRole('button', { name: 'Google Healthの連携を解除' }),
    )
    fireEvent.click(screen.getByRole('button', { name: '連携を解除する' }))

    expect(
      await screen.findByRole('heading', {
        name: /歩数を街の力に変えましょう。/,
      }),
    ).not.toBeNull()
    expect(screen.getByText('Walk City テストユーザー')).not.toBeNull()
  })

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
