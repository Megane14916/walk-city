import { Navigate } from 'react-router-dom'
import { LoginButton } from '../../features/auth/components'
import { useAuth } from '../../features/auth/hooks'
import { OnboardingLayout } from '../layouts/OnboardingLayout'
import { paths } from '../paths'

export function LoginPage() {
  const { state, refresh } = useAuth()
  const primaryButtonClass =
    'flex min-h-[58px] w-full cursor-pointer items-center justify-center gap-3.5 rounded-[15px] border-0 bg-[#123f3c] px-5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(9,54,51,.18)] transition-[transform,box-shadow,background] duration-200 enabled:hover:-translate-y-0.5 enabled:hover:bg-[#0b322f] enabled:hover:shadow-[0_16px_34px_rgba(9,54,51,.23)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)] disabled:cursor-wait disabled:opacity-[.58] [&>b]:ml-auto [&>b]:text-xl'
  const screenCardClass =
    'motion-safe:animate-onboarding-enter motion-reduce:animate-none'
  const screenTitleClass =
    'm-0 text-[clamp(38px,4.3vw,57px)] leading-[1.12] tracking-[-.055em] text-[#102f2d] max-[560px]:text-4xl'
  const eyebrowClass =
    'mb-[17px] block text-xs font-extrabold tracking-[.19em] text-[#438c76]'
  const leadClass = 'my-5 mb-[30px] text-[15px] leading-[1.75] text-[#66706d]'

  if (state.status === 'authenticated') {
    return <Navigate to={paths.healthConnect} replace />
  }

  if (state.status === 'initializing') {
    return (
      <OnboardingLayout>
        <div className="grid min-h-[420px] place-content-center justify-items-center gap-[17px] text-[#71807b]" aria-live="polite">
          <span className="grid h-12 w-12 place-items-center rounded-[15px_15px_15px_4px] bg-[#ffcf57] font-black text-[#103b37] motion-safe:animate-loading-mark motion-reduce:animate-none">W</span>
          <p className="text-[11px]">街への入り口を準備しています…</p>
        </div>
      </OnboardingLayout>
    )
  }

  if (state.status === 'error') {
    return (
      <OnboardingLayout>
        <div className={screenCardClass}>
          <div className={eyebrowClass}>WELCOME TO WALK CITY</div>
          <h1 className={screenTitleClass}>ログイン状態を<br />確認できませんでした。</h1>
          <p className={leadClass}>{state.error.message}</p>
          <button
            className={primaryButtonClass}
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
      <div className={screenCardClass}>
        <div className={eyebrowClass}>WELCOME TO WALK CITY</div>
        <h1 className={screenTitleClass}>今日の一歩から、<br />街づくりを始めよう。</h1>
        <p className={leadClass}>
          Googleアカウントでログインすると、歩数を街づくりに活かせます。
        </p>

        <LoginButton />

        <p className="mx-2 mt-[17px] mb-0 flex items-start gap-2 text-[11px] leading-[1.65] text-[#858b88] before:mt-[3px] before:text-[7px] before:text-[#58a889] before:content-['●']">
          ログイン時点では健康データへアクセスしません。
          歩数連携は次の画面で選べます。
        </p>

        <div className="mt-[37px] grid grid-cols-3 gap-4 border-t border-[#dedfd7] pt-[25px] max-[560px]:grid-cols-1 max-[560px]:gap-3 [&>div]:flex [&>div]:gap-2.5 [&>div>span]:text-[10px] [&>div>span]:font-black [&>div>span]:text-[#53a283] [&_p]:m-0 [&_b]:block [&_b]:text-xs [&_b]:text-[#193b38] [&_small]:mt-1.5 [&_small]:block [&_small]:text-[10px] [&_small]:leading-[1.5] [&_small]:text-[#89908d] max-[560px]:[&_small]:hidden">
          <div><span>01</span><p><b>歩数がコインに</b><small>毎日の活動を街づくりの力へ</small></p></div>
          <div><span>02</span><p><b>自分だけの街</b><small>建物を集めて人口を増やそう</small></p></div>
          <div><span>03</span><p><b>みんなと競える</b><small>人口ランキングで街を発見</small></p></div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
