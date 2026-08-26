import { useState, type ReactNode } from 'react'
import { useHealthConnection } from '../hooks'
import { HealthConnectionStatus } from './HealthConnectionStatus'

const DAILY_GOAL = 10_000

export type HealthConnectionPanelProps = {
  account: ReactNode
  onSkip(): void
  onContinue(): void
}

function formatSteps(value: number) {
  return new Intl.NumberFormat('ja-JP').format(value)
}

export function HealthConnectionPanel({
  account,
  onSkip,
  onContinue,
}: HealthConnectionPanelProps) {
  const {
    connection,
    dailySteps,
    today,
    pending,
    error,
    notice,
    connect,
    sync,
    disconnect,
  } = useHealthConnection()
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false)
  const status = connection?.status ?? 'not_connected'
  const isConnected = status === 'connected'
  const needsPermission = status === 'permission_required'
  const stepPercent = Math.min(
    100,
    Math.round(((dailySteps?.steps ?? 0) / DAILY_GOAL) * 100),
  )

  return (
    <>
      {isConnected ? (
        <div className="screen-card connected-screen">
          {account}
          <HealthConnectionStatus connected />

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
              <small>
                最終同期 {dailySteps
                  ? new Date(dailySteps.syncedAt).toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'まだありません'}
              </small>
            </div>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={onContinue}
            disabled={pending !== null}
          >
            <span>街づくりを始める</span>
            <b aria-hidden="true">→</b>
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => void sync()}
            disabled={pending !== null}
          >
            {pending === 'syncing' ? '歩数を更新中…' : '今日の歩数を更新 ↻'}
          </button>

          {isConfirmingDisconnect ? (
            <div
              className="mt-4 rounded-xl border border-[#e5c1bd] bg-[#fff4f1] p-4 text-center"
              role="alertdialog"
              aria-label="Google Health連携の解除確認"
            >
              <p className="m-0 text-xs leading-5 text-[#7d4a47]">
                解除すると、新しい歩数を取得できなくなります。ログイン状態は維持されます。
              </p>
              <div className="mt-3 flex justify-center gap-3">
                <button
                  className="rounded-lg border border-[#d7d8d2] bg-white px-4 py-2 text-xs font-bold text-[#596561]"
                  type="button"
                  onClick={() => setIsConfirmingDisconnect(false)}
                  disabled={pending !== null}
                >
                  キャンセル
                </button>
                <button
                  className="rounded-lg border-0 bg-[#a6534f] px-4 py-2 text-xs font-bold text-white"
                  type="button"
                  onClick={() => {
                    void disconnect().finally(() =>
                      setIsConfirmingDisconnect(false),
                    )
                  }}
                  disabled={pending !== null}
                >
                  {pending === 'disconnecting' ? '解除中…' : '連携を解除する'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="text-button danger-text"
              type="button"
              onClick={() => setIsConfirmingDisconnect(true)}
              disabled={pending !== null}
            >
              Google Healthの連携を解除
            </button>
          )}
        </div>
      ) : (
        <div className="screen-card connect-screen">
          {account}
          <HealthConnectionStatus connected={false} />

          <div className="health-symbol" aria-hidden="true">
            <span>♥</span>
            <i>＋</i>
            <b>W</b>
          </div>
          <div className="screen-eyebrow">
            {needsPermission ? 'RECONNECT GOOGLE HEALTH' : 'STEP 2 OF 2'}
          </div>
          <h1>
            {needsPermission ? (
              <>歩数の読み取りを<br />再許可してください。</>
            ) : (
              <>歩数を街の力に<br />変えましょう。</>
            )}
          </h1>
          <p className="screen-lead">
            {needsPermission
              ? 'Google Healthの歩数権限が不足しています。再連携して読み取りを許可してください。'
              : 'Google Healthから歩数だけを読み取ります。心拍数や位置情報は取得しません。'}
          </p>

          <div className="permission-card">
            <span className="permission-icon">⌁</span>
            <p><b>読み取るデータ</b><small>歩数（読み取り専用）</small></p>
            <span className="permission-status">
              {needsPermission ? '再同意が必要' : '最小権限'}
            </span>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={() => void connect()}
            disabled={pending !== null}
          >
            <span>
              {pending === 'connecting'
                ? '連携中…'
                : needsPermission
                  ? 'Google Healthを再連携する'
                  : 'Google Healthと連携する'}
            </span>
            <b aria-hidden="true">→</b>
          </button>
          <button
            className="text-button"
            type="button"
            onClick={onSkip}
            disabled={pending !== null}
          >
            今は連携しない
          </button>
        </div>
      )}

      <div className="message-area" aria-live="polite">
        {error && <p className="error-message"><span>!</span>{error}</p>}
        {!error && notice && (
          <p className="notice-message"><span>✓</span>{notice}</p>
        )}
      </div>
    </>
  )
}
