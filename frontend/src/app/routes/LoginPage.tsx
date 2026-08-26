import { Navigate } from 'react-router-dom'
import { LoginButton } from '../../features/auth/components'
import { useAuth } from '../../features/auth/hooks'
import { OnboardingLayout } from '../layouts/OnboardingLayout'
import { paths } from '../paths'

export function LoginPage() {
  const { state, refresh } = useAuth()

  if (state.status === 'authenticated') {
    return <Navigate to={paths.healthConnect} replace />
  }

  if (state.status === 'initializing') {
    return (
      <OnboardingLayout>
        <div className="loading-state" aria-live="polite">
          <span className="loading-mark">W</span>
          <p>街への入り口を準備しています…</p>
        </div>
      </OnboardingLayout>
    )
  }

  if (state.status === 'error') {
    return (
      <OnboardingLayout>
        <div className="screen-card signed-out-screen">
          <div className="screen-eyebrow">WELCOME TO WALK CITY</div>
          <h1>ログイン状態を<br />確認できませんでした。</h1>
          <p className="screen-lead">{state.error.message}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => void refresh()}
          >
            <span>もう一度試す</span>
            <b aria-hidden="true">↻</b>
          </button>
        </div>
      </OnboardingLayout>
    )
  }

  return (
    <OnboardingLayout>
      <div className="screen-card signed-out-screen">
        <div className="screen-eyebrow">WELCOME TO WALK CITY</div>
        <h1>今日の一歩から、<br />街づくりを始めよう。</h1>
        <p className="screen-lead">
          Googleアカウントでログインすると、歩数を街づくりに活かせます。
        </p>

        <LoginButton />

        <p className="privacy-note">
          ログイン時点では健康データへアクセスしません。
          歩数連携は次の画面で選べます。
        </p>

        <div className="benefit-list">
          <div><span>01</span><p><b>歩数がコインに</b><small>毎日の活動を街づくりの力へ</small></p></div>
          <div><span>02</span><p><b>自分だけの街</b><small>建物を集めて人口を増やそう</small></p></div>
          <div><span>03</span><p><b>みんなと競える</b><small>人口ランキングで街を発見</small></p></div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
