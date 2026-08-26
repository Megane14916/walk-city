import { useState } from 'react'
import { useAuth } from '../hooks'

export function UserMenu() {
  const { state, signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (state.status !== 'authenticated') return null

  const handleSignOut = async () => {
    if (isSigningOut) return

    setError(null)
    setIsSigningOut(true)
    try {
      const result = await signOut()
      if (!result.ok) setError(result.error.message)
    } catch {
      setError('ログアウトできませんでした。もう一度お試しください。')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <>
      <div className="mb-7 grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[#dedfd7] pb-[17px] [&_b]:block [&_b]:text-xs [&_b]:text-[#193b38] [&_small]:mt-0.5 [&_small]:block [&_small]:text-[10px] [&_small]:text-[#909693]">
        <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[#bfe2d4] font-black text-[#103b37]">
          {state.session.user.displayName.slice(0, 1)}
        </span>
        <div>
          <b>{state.session.user.displayName}</b>
          <small>{state.session.user.email}</small>
        </div>
        <button
          className="cursor-pointer border-0 bg-transparent text-[10px] text-[#64716d] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)] disabled:cursor-wait disabled:opacity-[.58]"
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? 'ログアウト中…' : 'ログアウト'}
        </button>
      </div>
      {error && (
        <div className="mt-[11px] min-h-[47px]" aria-live="polite">
          <p className="m-0 flex items-center gap-2 rounded-[10px] bg-[#fde8e4] px-3 py-2.5 text-[10px] text-[#903f3c]"><span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#ce5a55] font-black text-white">!</span>{error}</p>
        </div>
      )}
    </>
  )
}
