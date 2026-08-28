import { Link } from 'react-router-dom'
import type { ApiError } from '../../../types/common'

export type UserProfileErrorStateProps = {
  error: ApiError
  loginHref: string
  rankingHref: string
  onRetry: () => void
}

type ErrorContent = {
  eyebrow: string
  title: string
  description: string
  action: 'ranking' | 'login' | 'retry'
  symbol: string
}

function getErrorContent(code: ApiError['code']): ErrorContent {
  switch (code) {
    case 'INVALID_INPUT':
      return {
        eyebrow: 'INVALID USER',
        title: 'ユーザーを特定できませんでした',
        description: 'URLを確認するか、ランキングからユーザーを選び直してください。',
        action: 'ranking',
        symbol: '?',
      }
    case 'NOT_FOUND':
      return {
        eyebrow: 'USER NOT FOUND',
        title: 'ユーザーを見つけられませんでした',
        description: '対象のユーザーまたは公開中の街を確認できませんでした。',
        action: 'ranking',
        symbol: '⌕',
      }
    case 'UNAUTHENTICATED':
      return {
        eyebrow: 'SESSION EXPIRED',
        title: 'ログインが必要です',
        description: 'セッションの有効期限が切れました。もう一度ログインしてください。',
        action: 'login',
        symbol: '↗',
      }
    default:
      return {
        eyebrow: 'CONNECTION ERROR',
        title: 'ユーザー情報を読み込めませんでした',
        description: '通信状況を確認して、時間をおいてもう一度お試しください。',
        action: 'retry',
        symbol: '!',
      }
  }
}

export function UserProfileErrorState({
  error,
  loginHref,
  rankingHref,
  onRetry,
}: UserProfileErrorStateProps) {
  const content = getErrorContent(error.code)

  return (
    <section
      className="mx-auto grid min-h-[calc(100svh-68px)] w-full max-w-[680px] place-content-center justify-items-center px-5 py-12 text-center text-[#183b37]"
      role="alert"
      aria-labelledby="user-profile-error-title"
    >
      <span
        className="grid h-16 w-16 place-items-center rounded-[21px_21px_21px_7px] bg-[#f4dcd7] text-2xl font-black text-[#a94e49]"
        aria-hidden="true"
      >
        {content.symbol}
      </span>
      <span className="mt-5 text-[10px] font-black tracking-[.18em] text-[#a4665f]">
        {content.eyebrow}
      </span>
      <h1
        className="mt-2 mb-0 text-[clamp(27px,5vw,40px)] leading-[1.2] tracking-[-.04em] text-[#193b38]"
        id="user-profile-error-title"
      >
        {content.title}
      </h1>
      <p className="mt-4 mb-0 max-w-[460px] text-sm leading-7 text-[#747e7a]">
        {content.description}
      </p>

      {content.action === 'retry' ? (
        <button
          className="mt-7 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-[13px] border-0 bg-[#123f3c] px-6 text-xs font-extrabold text-white shadow-[0_9px_22px_rgba(9,54,51,.15)] hover:bg-[#0b322f] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)]"
          type="button"
          onClick={onRetry}
        >
          もう一度試す
        </button>
      ) : (
        <Link
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-[13px] bg-[#123f3c] px-6 text-xs font-extrabold text-white no-underline shadow-[0_9px_22px_rgba(9,54,51,.15)] hover:bg-[#0b322f] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)]"
          to={content.action === 'login' ? loginHref : rankingHref}
        >
          {content.action === 'login' ? 'ログインへ' : 'ランキングへ戻る'}
        </Link>
      )}

      {content.action !== 'ranking' && (
        <Link
          className="mt-4 inline-flex min-h-11 items-center px-3 text-xs font-extrabold text-[#357762] no-underline hover:text-[#194c42] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(40,124,100,.32)]"
          to={rankingHref}
        >
          ランキングへ戻る
        </Link>
      )}
    </section>
  )
}
