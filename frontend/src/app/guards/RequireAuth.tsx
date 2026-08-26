import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { mockGoogleIntegrationApi } from '../../features/auth/api'
import { paths } from '../paths'

type AuthGuardState =
  | { status: 'checking' }
  | { status: 'authenticated' }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string }

export type RequireAuthProps = {
  children: ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<AuthGuardState>({ status: 'checking' })

  useEffect(() => {
    let active = true

    void mockGoogleIntegrationApi.getState().then((result) => {
      if (!active) return
      if (!result.ok) {
        setState({ status: 'error', message: result.error.message })
        return
      }

      setState(
        result.data.session
          ? { status: 'authenticated' }
          : { status: 'unauthenticated' },
      )
    })

    return () => {
      active = false
    }
  }, [attempt])

  if (state.status === 'checking') {
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
        <p className="m-0 text-xs text-[#747e7a]">{state.message}</p>
        <button
          className="mt-2 min-h-11 rounded-xl border-0 bg-[#123f3c] px-5 text-xs font-extrabold text-white hover:bg-[#0b322f]"
          type="button"
          onClick={() => {
            setState({ status: 'checking' })
            setAttempt((current) => current + 1)
          }}
        >
          再試行
        </button>
      </main>
    )
  }

  return children
}
