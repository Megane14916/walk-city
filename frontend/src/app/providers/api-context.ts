import { createContext } from 'react'
import type { GoogleIntegrationApi } from '../../features/auth/api'

export type ApiServices = {
  googleIntegrationApi: GoogleIntegrationApi
}

export const ApiContext = createContext<ApiServices | null>(null)
