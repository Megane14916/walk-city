import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ApiProvider, AuthProvider } from './app/providers'
import { AppRouter } from './app/router.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ApiProvider>
  </StrictMode>,
)
