import { useState } from 'react'
import { useAuth } from '../hooks'

function GoogleMark() {
  return (
    <span className="grid h-[22px] w-[22px] rotate-45 grid-cols-2 gap-0.5 [&>span]:rounded-sm" aria-hidden="true">
      <span className="bg-[#4285f4]" />
      <span className="bg-[#ea4335]" />
      <span className="bg-[#34a853]" />
      <span className="bg-[#fbbc05]" />
    </span>
  )
}

export function LoginButton() {
  const { signInWithGoogle } = useAuth()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    if (isSigningIn) return

    setError(null)
    setIsSigningIn(true)
    try {
      const result = await signInWithGoogle()
      if (!result.ok) setError(result.error.message)
    } catch {
      setError('Googleログインを開始できませんでした。もう一度お試しください。')
    } finally {
      setIsSigningIn(false)
    }
  }

  return (
    <>
      <button
        className="flex min-h-[58px] w-full cursor-pointer items-center justify-center gap-3.5 rounded-[15px] border border-[#dedfd8] bg-white px-5 text-sm font-extrabold text-[#25302e] shadow-[0_10px_25px_rgba(19,43,39,.07)] transition-[transform,box-shadow,background] duration-200 enabled:hover:-translate-y-0.5 enabled:hover:bg-white enabled:hover:shadow-[0_14px_32px_rgba(19,43,39,.11)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)] disabled:cursor-wait disabled:opacity-[.58] [&>b]:ml-auto [&>b]:text-xl"
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
      >
        <GoogleMark />
        <span>{isSigningIn ? 'ログイン中…' : 'Googleで続ける'}</span>
        <b aria-hidden="true">→</b>
      </button>

      <div className="mt-[11px] min-h-[47px]" aria-live="polite">
        {error && (
          <p className="m-0 flex items-center gap-2 rounded-[10px] bg-[#fde8e4] px-3 py-2.5 text-[10px] text-[#903f3c]">
            <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#ce5a55] font-black text-white">!</span>
            {error}
          </p>
        )}
      </div>
    </>
  )
}
