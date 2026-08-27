import { createContext } from 'react'
import type { GoogleIntegrationApi } from '../../features/auth/api'
import type { StepSyncApi } from '../../features/health/api'
import type { TownApi } from '../../features/town/api'

export type ApiServices = {
  googleIntegrationApi: GoogleIntegrationApi
  stepSyncApi: StepSyncApi
  townApi: TownApi
}

export const ApiContext = createContext<ApiServices | null>(null)
