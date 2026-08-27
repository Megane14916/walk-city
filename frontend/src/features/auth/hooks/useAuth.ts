import { use } from 'react'
import { AuthContext } from '../auth-context'

export function useAuth() {
  const auth = use(AuthContext)
  if (!auth) {
    throw new Error('useAuthはAuthProviderの内側で使用してください。')
  }
  return auth
}
