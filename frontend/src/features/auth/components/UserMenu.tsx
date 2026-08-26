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
      <div className="account-row">
        <span className="avatar">
          {state.session.user.displayName.slice(0, 1)}
        </span>
        <div>
          <b>{state.session.user.displayName}</b>
          <small>{state.session.user.email}</small>
        </div>
        <button type="button" onClick={handleSignOut} disabled={isSigningOut}>
          {isSigningOut ? 'ログアウト中…' : 'ログアウト'}
        </button>
      </div>
      {error && (
        <div className="message-area" aria-live="polite">
          <p className="error-message"><span>!</span>{error}</p>
        </div>
      )}
    </>
  )
}
