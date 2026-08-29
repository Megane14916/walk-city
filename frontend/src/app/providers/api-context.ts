import { createContext } from 'react'
import type { GoogleIntegrationApi } from '../../features/auth/api'
import type { StepSyncApi } from '../../features/health/api'
import type { RankingApi } from '../../features/ranking/api'
import type { SettingsApi } from '../../features/settings/api'
import type { TownApi } from '../../features/town/api'

export type ApiServices = {
  googleIntegrationApi: GoogleIntegrationApi
  stepSyncApi: StepSyncApi
  rankingApi: RankingApi
  settingsApi: SettingsApi
  townApi: TownApi
}

export const ApiContext = createContext<ApiServices | null>(null)
