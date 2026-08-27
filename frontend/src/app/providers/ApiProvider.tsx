import { useState, type ReactNode } from 'react'
import { ApiContext, type ApiServices } from './api-context'
import { createApiServices } from './create-api-services'

export type ApiProviderProps = {
  children: ReactNode
  services?: ApiServices
}

export function ApiProvider({ children, services }: ApiProviderProps) {
  const [defaultServices] = useState(() => services ?? createApiServices())

  return (
    <ApiContext value={services ?? defaultServices}>{children}</ApiContext>
  )
}
