import { createContext } from 'react'
import type { ApiResult } from '../../types/common'
import type {
  AuthState,
  GoogleIntegrationState,
} from './types'

export type AuthContextValue = {
  state: AuthState
  integrationState: GoogleIntegrationState | null
  refresh(): Promise<ApiResult<GoogleIntegrationState>>
  signInWithGoogle(): Promise<ApiResult<GoogleIntegrationState>>
  signOut(): Promise<ApiResult<GoogleIntegrationState>>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
