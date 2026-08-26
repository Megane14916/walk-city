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
  const screenCardClass =
    'motion-safe:animate-onboarding-enter motion-reduce:animate-none'
  const screenTitleClass =
    'm-0 text-[clamp(38px,4.3vw,57px)] leading-[1.12] tracking-[-.055em] text-[#102f2d] max-[560px]:text-4xl'
  const primaryButtonClass =
    'flex min-h-[58px] w-full cursor-pointer items-center justify-center gap-3.5 rounded-[15px] border-0 bg-[#123f3c] px-5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(9,54,51,.18)] transition-[transform,box-shadow,background] duration-200 enabled:hover:-translate-y-0.5 enabled:hover:bg-[#0b322f] enabled:hover:shadow-[0_16px_34px_rgba(9,54,51,.23)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)] disabled:cursor-wait disabled:opacity-[.58] [&>b]:ml-auto [&>b]:text-xl'
  const textButtonClass =
    'mx-auto mt-4 block cursor-pointer border-0 bg-transparent text-[11px] font-bold text-[#60706c] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)] disabled:cursor-wait disabled:opacity-[.58]'

  return (
    <>
      {isConnected ? (
        <div className={screenCardClass}>
          {account}
          <HealthConnectionStatus connected />

          <div className="mb-[17px] inline-flex items-center gap-2 text-[11px] font-extrabold text-[#3c836b]"><span className="grid h-[21px] w-[21px] place-items-center rounded-full bg-[#4e9b7f] text-[10px] text-white">✓</span> 接続が完了しました</div>
          <h1 className={screenTitleClass}>街づくりの準備が<br />できました。</h1>

          <div className="my-5 mt-[25px] grid grid-cols-[auto_1fr] items-center gap-[23px] rounded-[21px] bg-[linear-gradient(135deg,#174c47,#0c3433)] p-[21px] text-white shadow-[0_18px_35px_rgba(11,51,49,.15)] max-[560px]:gap-[15px] max-[560px]:p-4">
            <div
              className="grid h-28 w-28 place-items-center rounded-full max-[560px]:h-[94px] max-[560px]:w-[94px]"
              role="progressbar"
              aria-label="今日の歩数目標"
              aria-valuemin={0}
              aria-valuemax={DAILY_GOAL}
              aria-valuenow={dailySteps?.steps ?? 0}
              style={{
                background: `conic-gradient(#ffcf57 ${stepPercent * 3.6}deg, rgba(255,255,255,.11) 0deg)`,
              }}
            >
              <div className="grid h-[91px] w-[91px] place-content-center rounded-full bg-[#123e3b] text-center max-[560px]:h-[75px] max-[560px]:w-[75px]"><b className="block text-2xl leading-none tracking-[-.04em] max-[560px]:text-xl">{formatSteps(dailySteps?.steps ?? 0)}</b><small className="mt-1.5 text-[9px] text-white/60">歩</small></div>
            </div>
            <div>
              <span className="text-[9px] font-extrabold tracking-[.1em] text-[#7cc9ae]">TODAY · {today.replaceAll('-', '.')}</span>
              <h3 className="mt-2 mb-1 text-[15px]">今日もいいペースです</h3>
              <p className="m-0 text-[10px] text-white/65">目標の{stepPercent}%まで到達しました。</p>
              <small className="mt-[13px] block text-[9px] text-white/40">
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
            className={primaryButtonClass}
            type="button"
            onClick={onContinue}
            disabled={pending !== null}
          >
            <span>街づくりを始める</span>
            <b aria-hidden="true">→</b>
          </button>
          <button
            className={textButtonClass}
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
                  className="rounded-lg border border-[#d7d8d2] bg-white px-4 py-2 text-xs font-bold text-[#596561] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)] disabled:cursor-wait disabled:opacity-[.58]"
                  type="button"
                  onClick={() => setIsConfirmingDisconnect(false)}
                  disabled={pending !== null}
                >
                  キャンセル
                </button>
                <button
                  className="rounded-lg border-0 bg-[#a6534f] px-4 py-2 text-xs font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)] disabled:cursor-wait disabled:opacity-[.58]"
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
              className={`${textButtonClass} text-[#a1605e]`}
              type="button"
              onClick={() => setIsConfirmingDisconnect(true)}
              disabled={pending !== null}
            >
              Google Healthの連携を解除
            </button>
          )}
        </div>
      ) : (
        <div className={screenCardClass}>
          {account}
          <HealthConnectionStatus connected={false} />

          <div className="mt-[7px] mb-[27px] flex items-center gap-2.5" aria-hidden="true">
            <span className="grid h-[54px] w-[54px] place-items-center rounded-[17px] bg-[#ffe4df] text-[21px] text-[#e65e5b]">♥</span>
            <i className="text-lg not-italic text-[#8c9491]">＋</i>
            <b className="grid h-[54px] w-[54px] place-items-center rounded-[17px] bg-[#ffcf57] text-[21px] text-[#103b37]">W</b>
          </div>
          <div className="mb-[17px] block text-xs font-extrabold tracking-[.19em] text-[#438c76]">
            {needsPermission ? 'RECONNECT GOOGLE HEALTH' : 'STEP 2 OF 2'}
          </div>
          <h1 className={screenTitleClass}>
            {needsPermission ? (
              <>歩数の読み取りを<br />再許可してください。</>
            ) : (
              <>歩数を街の力に<br />変えましょう。</>
            )}
          </h1>
          <p className="my-5 mb-[30px] text-[15px] leading-[1.75] text-[#66706d]">
            {needsPermission
              ? 'Google Healthの歩数権限が不足しています。再連携して読み取りを許可してください。'
              : 'Google Healthから歩数だけを読み取ります。心拍数や位置情報は取得しません。'}
          </p>

          <div className="mt-[-9px] mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-[13px] rounded-[14px] border border-[#d9ddd6] bg-white/60 px-[15px] py-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#dff0e8] text-xl text-[#16614f]">⌁</span>
            <p className="m-0"><b className="block text-[11px] text-[#23433f]">読み取るデータ</b><small className="mt-[3px] block text-[10px] text-[#87908c]">歩数（読み取り専用）</small></p>
            <span className="text-[9px] font-extrabold text-[#438c76] max-[560px]:hidden">
              {needsPermission ? '再同意が必要' : '最小権限'}
            </span>
          </div>

          <button
            className={primaryButtonClass}
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
            className={textButtonClass}
            type="button"
            onClick={onSkip}
            disabled={pending !== null}
          >
            今は連携しない
          </button>
        </div>
      )}

      <div className="mt-[11px] min-h-[47px]" aria-live="polite">
        {error && <p className="m-0 flex items-center gap-2 rounded-[10px] bg-[#fde8e4] px-3 py-2.5 text-[10px] text-[#903f3c]"><span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#ce5a55] font-black text-white">!</span>{error}</p>}
        {!error && notice && (
          <p className="m-0 flex items-center gap-2 rounded-[10px] bg-[#e2f1e9] px-3 py-2.5 text-[10px] text-[#2f735c]"><span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#4d9a7d] font-black text-white">✓</span>{notice}</p>
        )}
      </div>
    </>
  )
}
