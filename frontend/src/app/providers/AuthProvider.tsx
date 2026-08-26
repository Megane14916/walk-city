import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AuthContext } from '../../features/auth/auth-context'
import type {
  AuthState,
  GoogleIntegrationState,
} from '../../features/auth/types'
import type { ApiResult } from '../../types/common'
import { useApi } from './useApi'

export type AuthProviderProps = {
  children: ReactNode
}

function toAuthState(integration: GoogleIntegrationState): AuthState {
  return integration.session
    ? { status: 'authenticated', session: integration.session }
    : { status: 'unauthenticated' }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { googleIntegrationApi } = useApi()
  const [state, setState] = useState<AuthState>({ status: 'initializing' })
  const [integrationState, setIntegrationState] =
    useState<GoogleIntegrationState | null>(null)
  const requestId = useRef(0)

  const applyResult = useCallback(
    (result: ApiResult<GoogleIntegrationState>) => {
      if (result.ok) {
        setIntegrationState(result.data)
        setState(toAuthState(result.data))
      } else {
        setIntegrationState(null)
        setState({ status: 'error', error: result.error })
      }
      return result
    },
    [],
  )

  const refresh = useCallback(async () => {
    const currentRequestId = ++requestId.current
    const result = await googleIntegrationApi.getGoogleIntegrationState()
    if (currentRequestId === requestId.current) applyResult(result)
    return result
  }, [applyResult, googleIntegrationApi])

  const signInWithGoogle = useCallback(async () => {
    const result = await googleIntegrationApi.signInWithGoogle()
    return applyResult(result)
  }, [applyResult, googleIntegrationApi])

  const signOut = useCallback(async () => {
    const result = await googleIntegrationApi.signOut()
    return applyResult(result)
  }, [applyResult, googleIntegrationApi])

  useEffect(() => {
    void refresh()
    const unsubscribe = googleIntegrationApi.subscribeToAuthChanges(() => {
      void refresh()
    })

    return () => {
      requestId.current += 1
      unsubscribe()
    }
  }, [googleIntegrationApi, refresh])

  const value = useMemo(
    () => ({
      state,
      integrationState,
      refresh,
      signInWithGoogle,
      signOut,
    }),
    [integrationState, refresh, signInWithGoogle, signOut, state],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
