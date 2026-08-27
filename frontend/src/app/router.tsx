import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './guards/RequireAuth'
import { GameLayout } from './layouts/GameLayout'
import { paths } from './paths'
import { AuthCallbackPage } from './routes/AuthCallbackPage'
import { HealthConnectionPage } from './routes/HealthConnectionPage'
import { LoginPage } from './routes/LoginPage'
import { NotFoundPage } from './routes/NotFoundPage'
import { RankingPage } from './routes/RankingPage'
import { TownPage } from './routes/TownPage'
import { UserPage } from './routes/UserPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.login} element={<LoginPage />} />
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
        <Route path={paths.ranking} element={<RankingPage />} />
        <Route path={paths.userPattern} element={<UserPage />} />
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
