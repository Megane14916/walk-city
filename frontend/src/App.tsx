import { useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from './app/paths'
import { useApi } from './app/providers'
import { useAuth } from './features/auth/hooks'
import type { DailySteps } from './features/health/types'
import './App.css'

const TIMEZONE = 'Australia/Sydney'
const DAILY_GOAL = 10_000

type PendingAction =
  | 'signing-in'
  | 'connecting'
  | 'syncing'
  | 'disconnecting'
  | 'signing-out'
  | null

function todayInSydney() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatSteps(value: number) {
  return new Intl.NumberFormat('ja-JP').format(value)
}

function GoogleMark() {
  return (
    <span className="google-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  )
}

function BrandScene() {
  return (
    <div className="city-scene" aria-hidden="true">
      <div className="sun" />
      <div className="cloud cloud-one" />
      <div className="cloud cloud-two" />
      <div className="building building-one">
        <span /><span /><span /><span />
      </div>
      <div className="building building-two">
        <span /><span /><span /><span /><span /><span />
      </div>
      <div className="building building-three">
        <span /><span />
      </div>
      <div className="tree tree-one"><span /></div>
      <div className="tree tree-two"><span /></div>
      <div className="road">
        <i /><i /><i /><i />
      </div>
      <div className="walker"><span /></div>
    </div>
  )
}

function ProgressSteps({ connected }: { connected: boolean }) {
  return (
    <ol className="setup-progress" aria-label="設定の進行状況">
      <li className="is-complete">
        <span>✓</span>
        <div><b>Googleログイン</b><small>完了</small></div>
      </li>
      <li className={connected ? 'is-complete' : 'is-current'}>
        <span>{connected ? '✓' : '2'}</span>
        <div><b>歩数を連携</b><small>{connected ? '完了' : 'あと少し'}</small></div>
      </li>
    </ol>
  )
}

function App() {
  const { googleIntegrationApi } = useApi()
  const {
    state: authState,
    integrationState,
    refresh,
    signInWithGoogle,
    signOut,
  } = useAuth()
  const [dailySteps, setDailySteps] = useState<DailySteps | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [today] = useState(() => todayInSydney())
  const session =
    authState.status === 'authenticated' ? authState.session : null
  const healthConnection = integrationState?.healthConnection ?? null
  const isConnected = healthConnection?.status === 'connected'

  const clearMessages = () => {
    setError(null)
    setNotice(null)
  }

  const handleSignIn = async () => {
    clearMessages()
    setPending('signing-in')
    const result = await signInWithGoogle()
    if (result.ok) {
      if (result.data.healthConnection?.status === 'connected') {
        const stepsResult = await googleIntegrationApi.getDailySteps({
          date: today,
          timezone: TIMEZONE,
        })
        if (stepsResult.ok) setDailySteps(stepsResult.data)
      }
      setNotice('Googleアカウントでログインしました。')
    } else {
      setError(result.error.message)
    }
    setPending(null)
  }

  const handleConnect = async () => {
    clearMessages()
    setPending('connecting')
    const result = await googleIntegrationApi.startGoogleHealthConnection()

    if (!result.ok) {
      setError(result.error.message)
      setPending(null)
      return
    }

    if (result.data.next === 'redirect') {
      window.location.assign(result.data.authorizationUrl)
      return
    }

    await refresh()
    const stepsResult = await googleIntegrationApi.getDailySteps({
      date: today,
      timezone: TIMEZONE,
    })
    if (stepsResult.ok) setDailySteps(stepsResult.data)
    setNotice('Google Healthとの連携が完了しました。')
    setPending(null)
  }

  const handleSync = async () => {
    clearMessages()
    setPending('syncing')
    const result = await googleIntegrationApi.getDailySteps({
      date: today,
      timezone: TIMEZONE,
    })
    if (result.ok) {
      setDailySteps(result.data)
      setNotice('今日の歩数を更新しました。')
      await refresh()
    } else {
      setError(result.error.message)
    }
    setPending(null)
  }

  const handleDisconnect = async () => {
    clearMessages()
    setPending('disconnecting')
    const result = await googleIntegrationApi.disconnectGoogleHealth()
    if (result.ok) {
      await refresh()
      setDailySteps(null)
      setNotice('Google Healthの連携を解除しました。')
    } else {
      setError(result.error.message)
    }
    setPending(null)
  }

  const handleSignOut = async () => {
    clearMessages()
    setPending('signing-out')
    const result = await signOut()
    if (result.ok) {
      setDailySteps(null)
      setNotice('ログアウトしました。')
    } else {
      setError(result.error.message)
    }
    setPending(null)
  }

  const stepPercent = Math.min(
    100,
    Math.round(((dailySteps?.steps ?? 0) / DAILY_GOAL) * 100),
  )

  return (
    <main className="app-shell">
      <aside className="brand-panel">
        <div className="brand-lockup">
          <span className="brand-icon">W</span>
          <span>Walk City</span>
        </div>

        <div className="brand-copy">
          <span className="brand-kicker">WALK. BUILD. GROW.</span>
          <h2>歩いた分だけ、<br />あなたの街が育っていく。</h2>
          <p>
            毎日の一歩をコインに変えて、あなただけの街をつくろう。
          </p>
        </div>

        <BrandScene />

        <div className="brand-proof">
          <span className="proof-avatars"><i>Y</i><i>M</i><i>K</i></span>
          <p><b>1,240人</b>が今週、街づくりを始めました</p>
        </div>
      </aside>

      <section className="auth-panel">
        <header className="auth-header">
          <div className="mobile-brand">
            <span className="brand-icon">W</span>
            <b>Walk City</b>
          </div>
        </header>

        <div className="auth-content">
          {authState.status === 'initializing' ? (
            <div className="loading-state" aria-live="polite">
              <span className="loading-mark">W</span>
              <p>街への入り口を準備しています…</p>
            </div>
          ) : !session ? (
            <div className="screen-card signed-out-screen">
              <div className="screen-eyebrow">WELCOME TO WALK CITY</div>
              <h1>今日の一歩から、<br />街づくりを始めよう。</h1>
              <p className="screen-lead">
                Googleアカウントでログインすると、歩数を街づくりに活かせます。
              </p>

              <button
                className="primary-button google-button"
                type="button"
                onClick={handleSignIn}
                disabled={pending !== null}
              >
                <GoogleMark />
                <span>{pending === 'signing-in' ? 'ログイン中…' : 'Googleで続ける'}</span>
                <b aria-hidden="true">→</b>
              </button>

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
          ) : !isConnected ? (
            <div className="screen-card connect-screen">
              <div className="account-row">
                <span className="avatar">{session.user.displayName.slice(0, 1)}</span>
                <div><b>{session.user.displayName}</b><small>{session.user.email}</small></div>
                <button type="button" onClick={handleSignOut} disabled={pending !== null}>ログアウト</button>
              </div>

              <ProgressSteps connected={false} />

              <div className="health-symbol" aria-hidden="true">
                <span>♥</span>
                <i>＋</i>
                <b>W</b>
              </div>
              <div className="screen-eyebrow">STEP 2 OF 2</div>
              <h1>歩数を街の力に<br />変えましょう。</h1>
              <p className="screen-lead">
                Google Healthから歩数だけを読み取ります。心拍数や位置情報は取得しません。
              </p>

              <div className="permission-card">
                <span className="permission-icon">⌁</span>
                <p><b>読み取るデータ</b><small>歩数（読み取り専用）</small></p>
                <span className="permission-status">最小権限</span>
              </div>

              <button
                className="primary-button"
                type="button"
                onClick={handleConnect}
                disabled={pending !== null}
              >
                <span>{pending === 'connecting' ? '連携中…' : 'Google Healthと連携する'}</span>
                <b aria-hidden="true">→</b>
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => setNotice('あとから設定画面で連携できます。')}
                disabled={pending !== null}
              >
                今は連携しない
              </button>
              <Link className="text-button no-underline" to={paths.ranking}>
                人口ランキングを見る
              </Link>
            </div>
          ) : (
            <div className="screen-card connected-screen">
              <div className="account-row">
                <span className="avatar">{session.user.displayName.slice(0, 1)}</span>
                <div><b>{session.user.displayName}</b><small>{session.user.email}</small></div>
                <button type="button" onClick={handleSignOut} disabled={pending !== null}>ログアウト</button>
              </div>

              <ProgressSteps connected />

              <div className="success-kicker"><span>✓</span> 接続が完了しました</div>
              <h1>街づくりの準備が<br />できました。</h1>

              <div className="steps-card">
                <div
                  className="steps-ring"
                  role="progressbar"
                  aria-label="今日の歩数目標"
                  aria-valuemin={0}
                  aria-valuemax={DAILY_GOAL}
                  aria-valuenow={dailySteps?.steps ?? 0}
                  style={{
                    background: `conic-gradient(#ffcf57 ${stepPercent * 3.6}deg, rgba(255,255,255,.11) 0deg)`,
                  }}
                >
                  <div><b>{formatSteps(dailySteps?.steps ?? 0)}</b><small>歩</small></div>
                </div>
                <div className="steps-copy">
                  <span>TODAY · {today.replaceAll('-', '.')}</span>
                  <h3>今日もいいペースです</h3>
                  <p>目標の{stepPercent}%まで到達しました。</p>
                  <small>最終同期 {dailySteps ? new Date(dailySteps.syncedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : 'まだありません'}</small>
                </div>
              </div>

              <button
                className="primary-button"
                type="button"
                onClick={handleSync}
                disabled={pending !== null}
              >
                <span>{pending === 'syncing' ? '歩数を更新中…' : '今日の歩数を更新'}</span>
                <b aria-hidden="true">↻</b>
              </button>
              <button
                className="text-button danger-text"
                type="button"
                onClick={handleDisconnect}
                disabled={pending !== null}
              >
                {pending === 'disconnecting' ? '解除中…' : 'Google Healthの連携を解除'}
              </button>
              <Link className="text-button no-underline" to={paths.ranking}>
                人口ランキングを見る →
              </Link>
              <Link className="text-button no-underline" to={paths.root}>
                自分の街を見る →
              </Link>
            </div>
          )}

          <div className="message-area" aria-live="polite">
            {(error || authState.status === 'error') && (
              <p className="error-message"><span>!</span>{error ?? (authState.status === 'error' ? authState.error.message : '')}</p>
            )}
            {!error && authState.status !== 'error' && notice && <p className="notice-message"><span>✓</span>{notice}</p>}
          </div>

        </div>

        <footer className="auth-footer">
          <span>© 2026 Walk City</span>
          <nav aria-label="フッターリンク"><a href="#privacy">プライバシー</a><a href="#help">ヘルプ</a></nav>
        </footer>
      </section>
    </main>
  )
}

export default App
