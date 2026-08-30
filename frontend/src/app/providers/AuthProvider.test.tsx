// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/hooks'
import {
  createMockGoogleIntegrationApi,
  createMockRankingApi,
  createMockSettingsApi,
  createMockStepSyncApi,
  createMockTownApi,
  createMockWalkCityStore,
} from '../../mocks/services'
import { ApiProvider } from './ApiProvider'
import { AuthProvider } from './AuthProvider'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function AuthProbe() {
  const { state, signInWithGoogle, signOut } = useAuth()
  const [actionResult, setActionResult] = useState('idle')

  const login = async () => {
    const result = await signInWithGoogle()
    setActionResult(result.ok ? 'success' : result.error.code)
  }

  const logout = async () => {
    const result = await signOut()
    setActionResult(result.ok ? 'success' : result.error.code)
  }

  return (
    <div>
      <output aria-label="認証状態">{state.status}</output>
      <output aria-label="操作結果">{actionResult}</output>
      <button type="button" onClick={() => void login()}>
        ログイン
      </button>
      <button type="button" onClick={() => void logout()}>
        ログアウト
      </button>
    </div>
  )
}

function renderProvider(
  api = createMockGoogleIntegrationApi({ latencyMs: 0 }),
) {
  const store = createMockWalkCityStore()
  return {
    api,
    ...render(
      <ApiProvider
        services={{
          googleIntegrationApi: api,
          stepSyncApi: createMockStepSyncApi({ latencyMs: 0, store }),
          rankingApi: createMockRankingApi({ latencyMs: 0, store }),
          settingsApi: createMockSettingsApi({ latencyMs: 0, store }),
          townApi: createMockTownApi({ latencyMs: 0, store }),
        }}
      >
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </ApiProvider>,
    ),
  }
}

describe('AuthProvider', () => {
  it('restores the session once when mounted', async () => {
    const api = createMockGoogleIntegrationApi({ latencyMs: 0 })
    const getState = vi.spyOn(api, 'getGoogleIntegrationState')
    renderProvider(api)

    expect(await screen.findByText('unauthenticated')).not.toBeNull()
    expect(getState).toHaveBeenCalledTimes(1)
  })

  it('updates state through useAuth login and logout actions', async () => {
    renderProvider()
    await screen.findByText('unauthenticated')

    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))
    expect(await screen.findByText('authenticated')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }))
    expect(await screen.findByText('unauthenticated')).not.toBeNull()
  })

  it('reacts to authentication changes emitted outside the provider', async () => {
    const { api } = renderProvider()
    await screen.findByText('unauthenticated')

    await act(async () => {
      await api.signInWithGoogle()
    })

    expect(await screen.findByText('authenticated')).not.toBeNull()
  })

  it('keeps the current auth state when an action fails', async () => {
    const api = createMockGoogleIntegrationApi({ latencyMs: 0 })
    api.setFailure('signInWithGoogle', 'OAUTH_CANCELLED')
    renderProvider(api)
    await screen.findByText('unauthenticated')

    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByText('OAUTH_CANCELLED')).not.toBeNull()
    expect(screen.getByText('unauthenticated')).not.toBeNull()
  })

  it('unsubscribes from auth changes when unmounted', async () => {
    const api = createMockGoogleIntegrationApi({ latencyMs: 0 })
    const subscribe = api.subscribeToAuthChanges.bind(api)
    const unsubscribe = vi.fn()
    vi.spyOn(api, 'subscribeToAuthChanges').mockImplementation((listener) => {
      const stop = subscribe(listener)
      return () => {
        stop()
        unsubscribe()
      }
    })
    const view = renderProvider(api)
    await screen.findByText('unauthenticated')

    view.unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
