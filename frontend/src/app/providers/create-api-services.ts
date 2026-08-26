import type { GoogleIntegrationApi } from '../../features/auth/api'
import {
  getSupabaseClientConfig,
  type SupabaseClientEnvironment,
} from '../../lib/supabase-config'
import { createMockGoogleIntegrationApi } from '../../mocks/services'
import type { ApiServices } from './api-context'

export type ApiMode = 'mock' | 'supabase'

export type ApiEnvironment = SupabaseClientEnvironment & {
  VITE_API_MODE?: string
}

export function resolveApiMode(value: string | undefined): ApiMode {
  const mode = value?.trim() || 'mock'
  if (mode === 'mock' || mode === 'supabase') return mode

  throw new Error(
    `VITE_API_MODEはmockまたはsupabaseを指定してください。現在値: ${mode}`,
  )
}

function createLazySupabaseGoogleIntegrationApi(
  environment: ApiEnvironment,
): GoogleIntegrationApi {
  getSupabaseClientConfig(environment)

  let servicePromise: Promise<GoogleIntegrationApi> | null = null
  const loadService = () => {
    servicePromise ??= Promise.all([
      import('../../lib/supabase'),
      import('../../features/auth/services'),
    ]).then(([{ createBrowserSupabaseClient }, { createSupabaseGoogleIntegrationApi }]) =>
      createSupabaseGoogleIntegrationApi(
        createBrowserSupabaseClient(environment),
      ),
    )
    return servicePromise
  }

  return {
    async getGoogleIntegrationState() {
      return (await loadService()).getGoogleIntegrationState()
    },
    async signInWithGoogle() {
      return (await loadService()).signInWithGoogle()
    },
    async signOut() {
      return (await loadService()).signOut()
    },
    async startGoogleHealthConnection() {
      return (await loadService()).startGoogleHealthConnection()
    },
    async disconnectGoogleHealth() {
      return (await loadService()).disconnectGoogleHealth()
    },
    async getDailySteps(input) {
      return (await loadService()).getDailySteps(input)
    },
  }
}

export function createApiServices(
  environment: ApiEnvironment = import.meta.env,
): ApiServices {
  const mode = resolveApiMode(environment.VITE_API_MODE)
  if (mode === 'mock') {
    return { googleIntegrationApi: createMockGoogleIntegrationApi() }
  }

  return {
    googleIntegrationApi: createLazySupabaseGoogleIntegrationApi(environment),
  }
}
