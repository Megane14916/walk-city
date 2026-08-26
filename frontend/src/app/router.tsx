import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from '../App'
import { RequireAuth } from './guards/RequireAuth'
import { GameLayout } from './layouts/GameLayout'
import { paths } from './paths'
import { NotFoundPage } from './routes/NotFoundPage'
import { RankingPage } from './routes/RankingPage'
import { UserPage } from './routes/UserPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.root} element={<Navigate to={paths.login} replace />} />
      <Route path={paths.login} element={<App />} />
      <Route
        element={
          <RequireAuth>
            <GameLayout />
          </RequireAuth>
        }
      >
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
