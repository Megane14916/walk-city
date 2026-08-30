import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './guards/RequireAuth'
import { GameLayout } from './layouts/GameLayout'
import { paths } from './paths'
import { AuthCallbackPage } from './routes/AuthCallbackPage'
import { HealthConnectionPage } from './routes/HealthConnectionPage'
import { LoginPage } from './routes/LoginPage'
import { NotFoundPage } from './routes/NotFoundPage'
import { PrivacyPolicyPage } from './routes/PrivacyPolicyPage'
import { TermsOfServicePage } from './routes/TermsOfServicePage'
import { TownPage } from './routes/TownPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.login} element={<LoginPage />} />
      <Route path={paths.privacy} element={<PrivacyPolicyPage />} />
      <Route path={paths.terms} element={<TermsOfServicePage />} />
      <Route path={paths.authCallback} element={<AuthCallbackPage />} />
      <Route
        path={paths.healthConnect}
        element={
          <RequireAuth>
            <HealthConnectionPage />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <GameLayout />
          </RequireAuth>
        }
      >
        <Route path={paths.root} element={<TownPage />} />
        <Route path={paths.townPattern} element={<TownPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
