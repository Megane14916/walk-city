import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/hooks'
import { paths } from '../paths'

export type RequireAuthProps = {
  children: ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { state, refresh } = useAuth()
  const location = useLocation()

  if (state.status === 'initializing') {
    return (
      <main
        className="grid min-h-svh place-content-center justify-items-center gap-4 bg-[#f7f6f0] text-[#71807b]"
        aria-busy="true"
      >
        <span className="grid h-12 w-12 animate-pulse place-items-center rounded-[15px_15px_15px_4px] bg-[#ffcf57] font-black text-[#103b37] motion-reduce:animate-none">
          W
        </span>
        <p className="m-0 text-xs">ログイン状態を確認しています…</p>
      </main>
    )
  }

  if (state.status === 'unauthenticated') {
    return (
      <Navigate
        to={paths.login}
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  if (state.status === 'error') {
    return (
      <main className="grid min-h-svh place-content-center justify-items-center gap-3 bg-[#f7f6f0] px-5 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#ce625b] text-xl font-black text-white">
          !
        </span>
        <h1 className="m-0 text-xl text-[#193b38]">
          ログイン状態を確認できませんでした
        </h1>
        <p className="m-0 text-xs text-[#747e7a]">{state.error.message}</p>
        <button
          className="mt-2 min-h-11 rounded-xl border-0 bg-[#123f3c] px-5 text-xs font-extrabold text-white hover:bg-[#0b322f]"
          type="button"
          onClick={() => {
            void refresh()
          }}
        >
          再試行
        </button>
      </main>
    )
  }

  return children
}
