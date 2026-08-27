import { use } from 'react'
import { ApiContext } from './api-context'

export function useApi() {
  const services = use(ApiContext)
  if (!services) {
    throw new Error('useApiはApiProviderの内側で使用してください。')
  }
  return services
}
