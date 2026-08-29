import type { GoogleIntegrationApi } from '../../features/auth/api'
import type { StepSyncApi } from '../../features/health/api'
import type { TownApi } from '../../features/town/api'
import {
  getSupabaseClientConfig,
  type SupabaseClientEnvironment,
} from '../../lib/supabase-config'
import {
  createMockGoogleIntegrationApi,
  createMockRankingApi,
  createMockStepSyncApi,
  createMockTownApi,
  createMockWalkCityStore,
} from '../../mocks/services'
import type { ApiServices } from './api-context'

export type ApiMode = 'mock' | 'supabase'

export type ApiEnvironment = SupabaseClientEnvironment & {
  VITE_API_MODE?: string
  PROD?: boolean
}

export function resolveApiMode(
  value: string | undefined,
  isProduction = false,
): ApiMode {
  const configuredMode = value?.trim()
  if (!configuredMode) {
    if (isProduction) {
      throw new Error(
        '本番環境ではVITE_API_MODE=supabaseの設定が必要です。',
      )
    }
    return 'mock'
  }

  if (configuredMode !== 'mock' && configuredMode !== 'supabase') {
    throw new Error(
      `VITE_API_MODEはmockまたはsupabaseを指定してください。現在値: ${configuredMode}`,
    )
  }

  if (isProduction && configuredMode !== 'supabase') {
    throw new Error(
      '本番環境ではVITE_API_MODE=supabase以外を使用できません。',
    )
  }

  return configuredMode
}

type SupabaseServiceBundle = {
  googleIntegrationApi: GoogleIntegrationApi
  stepSyncApi: StepSyncApi
  rankingApi: import('../../features/ranking/api').RankingApi
  townApi: TownApi
}

function createLazySupabaseServiceBundle(
  environment: ApiEnvironment,
): SupabaseServiceBundle {
  getSupabaseClientConfig(environment)

  let servicePromise: Promise<SupabaseServiceBundle> | null = null
  const loadService = () => {
    servicePromise ??= Promise.all([
      import('../../lib/supabase'),
      import('../../features/auth/services'),
      import('../../features/health/services'),
      import('../../features/ranking/services'),
      import('../../features/town/services'),
    ]).then(
      ([
        { createBrowserSupabaseClient },
        { createSupabaseGoogleIntegrationApi },
        { createSupabaseStepSyncApi },
        { createSupabaseRankingApi },
        { createSupabaseTownApi },
      ]) => {
        const supabase = createBrowserSupabaseClient(environment)
        return {
          googleIntegrationApi: createSupabaseGoogleIntegrationApi(supabase),
          stepSyncApi: createSupabaseStepSyncApi(supabase),
          rankingApi: createSupabaseRankingApi(supabase),
          townApi: createSupabaseTownApi(supabase),
        }
      },
    )
    return servicePromise
  }

  const googleIntegrationApi: GoogleIntegrationApi = {
    async getGoogleIntegrationState() {
      return (await loadService()).googleIntegrationApi.getGoogleIntegrationState()
    },
    subscribeToAuthChanges(listener) {
      let unsubscribe: (() => void) | null = null
      let active = true
      void loadService().then((service) => {
        if (!active) return
        unsubscribe = service.googleIntegrationApi.subscribeToAuthChanges(listener)
      })
      return () => {
        active = false
        unsubscribe?.()
      }
    },
    async signInWithGoogle() {
      return (await loadService()).googleIntegrationApi.signInWithGoogle()
    },
    async signOut() {
      return (await loadService()).googleIntegrationApi.signOut()
    },
    async startGoogleHealthConnection() {
      return (await loadService()).googleIntegrationApi.startGoogleHealthConnection()
    },
    async disconnectGoogleHealth() {
      return (await loadService()).googleIntegrationApi.disconnectGoogleHealth()
    },
    async getDailySteps(input) {
      return (await loadService()).googleIntegrationApi.getDailySteps(input)
    },
  }

  const stepSyncApi: StepSyncApi = {
    async syncSteps() {
      return (await loadService()).stepSyncApi.syncSteps()
    },
  }

  const rankingApi: import('../../features/ranking/api').RankingApi = {
    async getPopulationRanking(input) {
      return (await loadService()).rankingApi.getPopulationRanking(input)
    },
  }

  const townApi: TownApi = {
    supportsBuildingRename: false,
    async getBuildingCatalog() {
      return (await loadService()).townApi.getBuildingCatalog()
    },
    async getMyTown() {
      return (await loadService()).townApi.getMyTown()
    },
    async getPublicTown(userId) {
      return (await loadService()).townApi.getPublicTown(userId)
    },
    async placeBuilding(input) {
      return (await loadService()).townApi.placeBuilding(input)
    },
    async placeRoadLine(input) {
      return (await loadService()).townApi.placeRoadLine(input)
    },
    async moveBuilding(input) {
      return (await loadService()).townApi.moveBuilding(input)
    },
    async deleteRoad(input) {
      return (await loadService()).townApi.deleteRoad(input)
    },
    async renameBuilding(input) {
      return (await loadService()).townApi.renameBuilding(input)
    },
    async unlockLand(input) {
      return (await loadService()).townApi.unlockLand(input)
    },
  }

  return { googleIntegrationApi, stepSyncApi, rankingApi, townApi }
}

export function createApiServices(
  environment: ApiEnvironment = import.meta.env,
): ApiServices {
  const mode = resolveApiMode(
    environment.VITE_API_MODE,
    environment.PROD === true,
  )
  if (mode === 'mock') {
    const store = createMockWalkCityStore()
    return {
      googleIntegrationApi: createMockGoogleIntegrationApi(),
      stepSyncApi: createMockStepSyncApi({ store }),
      rankingApi: createMockRankingApi({ store }),
      townApi: createMockTownApi({ store }),
    }
  }

  const supabaseServices = createLazySupabaseServiceBundle(environment)
  return {
    ...supabaseServices,
  }
}
