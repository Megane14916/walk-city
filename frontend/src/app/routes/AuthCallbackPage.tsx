import { Navigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/hooks'
import { OnboardingLayout } from '../layouts/OnboardingLayout'
import { paths } from '../paths'

export function AuthCallbackPage() {
  const { state, refresh } = useAuth()

  if (state.status === 'authenticated') {
    return <Navigate to={paths.healthConnect} replace />
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to={paths.login} replace />
  }

  if (state.status === 'error') {
    return (
      <OnboardingLayout>
        <section className="screen-card signed-out-screen" role="alert">
          <div className="screen-eyebrow">GOOGLE LOGIN</div>
          <h1>ログインを<br />完了できませんでした。</h1>
          <p className="screen-lead">{state.error.message}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => void refresh()}
          >
            <span>もう一度確認する</span>
            <b aria-hidden="true">↻</b>
          </button>
        </section>
      </OnboardingLayout>
    )
  }

  return (
    <OnboardingLayout>
      <div className="loading-state" aria-live="polite">
        <span className="loading-mark">W</span>
        <p>Googleログインを完了しています…</p>
      </div>
    </OnboardingLayout>
  )
}
