import { ApiProvider, AuthProvider } from './providers'
import { AppRouter } from './router'

export function App() {
  return (
    <ApiProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ApiProvider>
  )
}
