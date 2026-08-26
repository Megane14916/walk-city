import { Navigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/hooks'
import { OnboardingLayout } from '../layouts/OnboardingLayout'
import { paths } from '../paths'

export function AuthCallbackPage() {
  const { state, refresh } = useAuth()
  const primaryButtonClass =
    'flex min-h-[58px] w-full cursor-pointer items-center justify-center gap-3.5 rounded-[15px] border-0 bg-[#123f3c] px-5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(9,54,51,.18)] transition-[transform,box-shadow,background] duration-200 enabled:hover:-translate-y-0.5 enabled:hover:bg-[#0b322f] enabled:hover:shadow-[0_16px_34px_rgba(9,54,51,.23)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)] disabled:cursor-wait disabled:opacity-[.58] [&>b]:ml-auto [&>b]:text-xl'

  if (state.status === 'authenticated') {
    return <Navigate to={paths.healthConnect} replace />
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to={paths.login} replace />
  }

  if (state.status === 'error') {
    return (
      <OnboardingLayout>
        <section className="motion-safe:animate-onboarding-enter motion-reduce:animate-none" role="alert">
          <div className="mb-[17px] block text-xs font-extrabold tracking-[.19em] text-[#438c76]">GOOGLE LOGIN</div>
          <h1 className="m-0 text-[clamp(38px,4.3vw,57px)] leading-[1.12] tracking-[-.055em] text-[#102f2d] max-[560px]:text-4xl">ログインを<br />完了できませんでした。</h1>
          <p className="my-5 mb-[30px] text-[15px] leading-[1.75] text-[#66706d]">{state.error.message}</p>
          <button
            className={primaryButtonClass}
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
      <div className="grid min-h-[420px] place-content-center justify-items-center gap-[17px] text-[#71807b]" aria-live="polite">
        <span className="grid h-12 w-12 place-items-center rounded-[15px_15px_15px_4px] bg-[#ffcf57] font-black text-[#103b37] motion-safe:animate-loading-mark motion-reduce:animate-none">W</span>
        <p className="text-[11px]">Googleログインを完了しています…</p>
      </div>
    </OnboardingLayout>
  )
}
