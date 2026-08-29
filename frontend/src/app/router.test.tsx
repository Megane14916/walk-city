// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GoogleIntegrationApi } from '../features/auth/api'
import { MOCK_PUBLIC_USER_ID } from '../mocks/data/towns'
import { MOCK_AUTH_USER } from '../mocks/data/users'
import {
  createMockGoogleIntegrationApi,
  mockGoogleIntegrationApi,
  mockRankingApi,
  mockStepSyncApi,
  mockTownApi,
} from '../mocks/services'
import { paths } from './paths'
import { ApiProvider, AuthProvider } from './providers'
import { AppRoutes } from './router'

function RouteLocation() {
  const location = useLocation()
  return <output data-testid="current-path">{location.pathname}</output>
}

function renderRoute(
  path: string,
  googleIntegrationApi: GoogleIntegrationApi = mockGoogleIntegrationApi,
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ApiProvider
        services={{
          googleIntegrationApi,
          stepSyncApi: mockStepSyncApi,
          rankingApi: mockRankingApi,
          townApi: mockTownApi,
        }}
      >
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ApiProvider>
      <RouteLocation />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockGoogleIntegrationApi.reset()
  mockRankingApi.reset()
  mockStepSyncApi.reset()
  mockTownApi.reset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('paths', () => {
  it('encodes user IDs for public town links', () => {
    expect(paths.town('user/with space')).toBe('/town/user%2Fwith%20space')
  })
})

describe('AppRoutes', () => {
  it('keeps the login action hidden while restoring the session', () => {
    const api = createMockGoogleIntegrationApi({ latencyMs: 50 })
    renderRoute(paths.login, api)

    expect(screen.getByText('街への入り口を準備しています…')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Googleで続ける' })).toBeNull()
  })

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

  it('finishes an authenticated OAuth callback at Health connection', async () => {
    const api = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
    })
    renderRoute(paths.authCallback, api)

    expect(
      await screen.findByRole('heading', {
        name: /歩数を街の力に変えましょう。/,
      }),
    ).not.toBeNull()
  })

  it('returns an unauthenticated OAuth callback to login', async () => {
    const api = createMockGoogleIntegrationApi({ latencyMs: 0 })
    renderRoute(paths.authCallback, api)

    expect(
      await screen.findByRole('heading', {
        name: /今日の一歩から、街づくりを始めよう。/,
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

  it('keeps the game available after Health OAuth is cancelled', async () => {
    const api = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
    })
    api.setFailure('startGoogleHealthConnection', 'OAUTH_CANCELLED')
    renderRoute(paths.healthConnect, api)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Google Healthと連携する',
      }),
    )
    expect(
      await screen.findByText('Google認証がキャンセルされました。'),
    ).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '今は連携しない' }))
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

  it('does not disconnect Health when the user only logs out', async () => {
    const api = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initiallyHealthConnected: true,
    })
    renderRoute(paths.healthConnect, api)

    fireEvent.click(await screen.findByRole('button', { name: 'ログアウト' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Googleで続ける' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: /街づくりの準備ができました。/,
      }),
    ).not.toBeNull()
  })

  it('redirects unauthenticated Health connection requests to login', async () => {
    renderRoute(paths.healthConnect)

    expect(
      await screen.findByRole('heading', {
        name: /今日の一歩から、街づくりを始めよう。/,
      }),
    ).not.toBeNull()
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

  it('loads a public town without private steps or coins', async () => {
    await mockGoogleIntegrationApi.signInWithGoogle()
    renderRoute(paths.town(MOCK_PUBLIC_USER_ID))

    expect(
      await screen.findByRole('heading', { name: 'ブルータウン' }),
    ).not.toBeNull()
    expect(screen.getByText('人口')).not.toBeNull()
    expect(screen.getByText('60人')).not.toBeNull()
    expect(screen.queryByText('今日の歩数')).toBeNull()
    expect(screen.queryByText('所持コイン数')).toBeNull()
    expect(screen.queryByRole('button', { name: /マーケット/ })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'マーケット' })).toBeNull()
    expect(
      screen
        .getByRole('link', { name: '自分の街に戻る' })
        .getAttribute('href'),
    ).toBe(paths.root)
  })

  it('replaces an own public-town URL with the authenticated root town', async () => {
    await mockGoogleIntegrationApi.signInWithGoogle()
    renderRoute(paths.town(MOCK_AUTH_USER.id))

    expect(
      await screen.findByRole('heading', { name: 'グリーンタウン' }),
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

  it('opens the market item list over the town map', async () => {
    await mockGoogleIntegrationApi.signInWithGoogle()
    renderRoute(paths.root)
    await screen.findByRole('heading', { name: 'グリーンタウン' })

    fireEvent.click(screen.getByRole('button', { name: /マーケット/ }))

    expect(
      screen.getByRole('heading', { name: 'マーケット' }),
    ).not.toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByText('未開放領域アンロック')).not.toBeNull()
    expect(
      screen.getByRole('application', { name: /グリーンタウンのマップ/ }),
    ).not.toBeNull()
  })

  it('navigates directly from a ranking item to the public town', async () => {
    await mockGoogleIntegrationApi.signInWithGoogle()
    renderRoute(paths.root)
    await screen.findByRole('heading', { name: 'グリーンタウン' })
    fireEvent.click(screen.getByRole('button', { name: /ランキング/ }))

    const firstRankingLink = await screen.findByRole('link', {
      name: /^1位、/,
    })
    fireEvent.click(firstRankingLink)

    expect(
      await screen.findByRole('application', {
        name: /サンライズシティのマップ/,
      }),
    ).not.toBeNull()
    expect(screen.getByTestId('current-path').textContent).toBe(
      paths.town('mock-ranking-user-001'),
    )
    expect(screen.queryByText('今日の歩数')).toBeNull()
    expect(screen.queryByText('所持コイン数')).toBeNull()
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
    renderRoute(paths.root)

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
