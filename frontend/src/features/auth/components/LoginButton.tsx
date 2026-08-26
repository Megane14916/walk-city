import { useState } from 'react'
import { useAuth } from '../hooks'

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
        className="primary-button google-button"
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
      >
        <GoogleMark />
        <span>{isSigningIn ? 'ログイン中…' : 'Googleで続ける'}</span>
        <b aria-hidden="true">→</b>
      </button>

      <div className="message-area" aria-live="polite">
        {error && (
          <p className="error-message">
            <span>!</span>
            {error}
          </p>
        )}
      </div>
    </>
  )
}
