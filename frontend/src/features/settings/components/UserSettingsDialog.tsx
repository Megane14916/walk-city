import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { ApiResult } from '../../../types/common'
import type { SettingsApi } from '../api'
import { useUserSettings } from '../hooks'
import {
  USER_SETTINGS_NAME_MAX_LENGTH,
  userSettingsNameLength,
} from '../settings-validation'
import type { UserSettings } from '../types'

export type UserSettingsDialogProps = {
  api: SettingsApi
  displayName: string
  townName: string
  loginHref: string
  onSaved: (settings: UserSettings) => void
  onClose: () => void
  onSignOut?: () => Promise<ApiResult<unknown>>
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'a[href]',
].join(',')

export function UserSettingsDialog({
  api,
  displayName,
  townName,
  loginHref,
  onSaved,
  onClose,
  onSignOut,
}: UserSettingsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const displayNameRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)
  const form = useUserSettings({
    api,
    initialSettings: { displayName, townName },
  })
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const handleSignOut = async () => {
    if (!onSignOut || isSigningOut) return

    setSignOutError(null)
    setIsSigningOut(true)
    try {
      const result = await onSignOut()
      if (!result.ok) setSignOutError(result.error.message)
    } catch {
      setSignOutError('ログアウトできませんでした。もう一度お試しください。')
    } finally {
      setIsSigningOut(false)
    }
  }

  useEffect(() => {
    submittingRef.current = form.isSubmitting
  }, [form.isSubmitting])

  useLayoutEffect(() => {
    const previouslyFocused = document.activeElement
    const backgroundElements = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== backdropRef.current,
    )
    const backgroundState = backgroundElements.map((element) => ({
      element,
      ariaHidden: element.getAttribute('aria-hidden'),
      inert: element.hasAttribute('inert'),
    }))
    for (const element of backgroundElements) {
      element.setAttribute('aria-hidden', 'true')
      element.setAttribute('inert', '')
    }
    displayNameRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!submittingRef.current) onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
          [],
      )
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      for (const { element, ariaHidden, inert } of backgroundState) {
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
        if (!inert) element.removeAttribute('inert')
      }
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [onClose])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const saved = await form.submit()
    if (!saved) return
    onSaved(saved)
    onClose()
  }

  const displayNameCount = userSettingsNameLength(form.values.displayName)
  const townNameCount = userSettingsNameLength(form.values.townName)

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[rgba(14,39,35,.56)] p-4 backdrop-blur-sm"
      data-testid="settings-backdrop"
    >
      <div
        ref={dialogRef}
        className="my-auto w-full max-w-[520px] overflow-y-auto rounded-[24px] border border-[#d2ddd5] bg-[#f8f7f1] shadow-[0_28px_90px_rgba(10,35,31,.32)] max-[520px]:max-h-[calc(100svh-32px)]"
        id="user-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-settings-title"
        aria-describedby="user-settings-description"
        aria-busy={form.isSubmitting}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#d8dfd8] px-6 py-5 max-[420px]:px-4">
          <div>
            <p className="m-0 text-[9px] font-black tracking-[.18em] text-[#61a58d]">
              PROFILE &amp; TOWN
            </p>
            <h2
              className="m-0 mt-1 text-xl font-black text-[#183b37]"
              id="user-settings-title"
            >
              設定
            </h2>
            <p
              className="m-0 mt-2 text-[11px] leading-relaxed text-[#6f7c77]"
              id="user-settings-description"
            >
              ユーザー名と街の名前はランキングや公開街に表示されます。
            </p>
          </div>
          <button
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-[#d7ddd6] bg-white text-base font-black text-[#52635e] shadow-sm hover:bg-[#edf3ef] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onClose}
            disabled={form.isSubmitting}
            aria-label="設定を閉じる"
          >
            ×
          </button>
        </div>

        <form className="grid gap-5 px-6 py-6 max-[420px]:px-4" onSubmit={handleSubmit}>
          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <label
                className="text-xs font-black text-[#234f47]"
                htmlFor="settings-display-name"
              >
                ユーザー名
              </label>
              <span className="text-[9px] font-bold text-[#7b8782]">
                {displayNameCount}/{USER_SETTINGS_NAME_MAX_LENGTH}文字
              </span>
            </div>
            <input
              ref={displayNameRef}
              className="min-h-12 w-full rounded-[14px] border border-[#cbd8d0] bg-white px-4 text-sm font-bold text-[#183b37] outline-none transition focus:border-[#5c9f88] focus:ring-4 focus:ring-[#cce5da] disabled:bg-[#eef1ed]"
              id="settings-display-name"
              name="displayName"
              value={form.values.displayName}
              onChange={(event) => form.setDisplayName(event.target.value)}
              disabled={form.isSubmitting}
              aria-invalid={form.errors.displayName ? true : undefined}
              aria-describedby={
                form.errors.displayName
                  ? 'settings-display-name-error settings-display-name-help'
                  : 'settings-display-name-help'
              }
              autoComplete="nickname"
            />
            <p
              className="m-0 mt-1.5 text-[10px] leading-relaxed text-[#7b8782]"
              id="settings-display-name-help"
            >
              30文字以内。ログイン後の全画面で使う公開名です。
            </p>
            {form.errors.displayName && (
              <p
                className="m-0 mt-1.5 text-[10px] font-bold text-[#a44e45]"
                id="settings-display-name-error"
              >
                {form.errors.displayName}
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <label
                className="text-xs font-black text-[#234f47]"
                htmlFor="settings-town-name"
              >
                街の名前
              </label>
              <span className="text-[9px] font-bold text-[#7b8782]">
                {townNameCount}/{USER_SETTINGS_NAME_MAX_LENGTH}文字
              </span>
            </div>
            <input
              className="min-h-12 w-full rounded-[14px] border border-[#cbd8d0] bg-white px-4 text-sm font-bold text-[#183b37] outline-none transition focus:border-[#5c9f88] focus:ring-4 focus:ring-[#cce5da] disabled:bg-[#eef1ed]"
              id="settings-town-name"
              name="townName"
              value={form.values.townName}
              onChange={(event) => form.setTownName(event.target.value)}
              disabled={form.isSubmitting}
              aria-invalid={form.errors.townName ? true : undefined}
              aria-describedby={
                form.errors.townName
                  ? 'settings-town-name-error settings-town-name-help'
                  : 'settings-town-name-help'
              }
            />
            <p
              className="m-0 mt-1.5 text-[10px] leading-relaxed text-[#7b8782]"
              id="settings-town-name-help"
            >
              30文字以内。街のヘッダーとランキングに公開されます。
            </p>
            {form.errors.townName && (
              <p
                className="m-0 mt-1.5 text-[10px] font-bold text-[#a44e45]"
                id="settings-town-name-error"
              >
                {form.errors.townName}
              </p>
            )}
          </div>

          {form.apiError && (
            <div
              className="rounded-[14px] border border-[#e7bbb3] bg-[#f9e6e1] px-4 py-3 text-[11px] font-bold text-[#8b473e]"
              role="alert"
            >
              <span>{form.apiError.message}</span>
              {form.apiError.code === 'UNAUTHENTICATED' && (
                <a className="ml-2 font-black text-[#71352f]" href={loginHref}>
                  再ログイン
                </a>
              )}
            </div>
          )}

          <div className="mt-1 grid grid-cols-2 gap-3 border-t border-[#d8dfd8] pt-5 max-[360px]:grid-cols-1">
            <button
              className="min-h-12 cursor-pointer rounded-[14px] border border-[#cbd5cf] bg-white px-4 text-xs font-black text-[#53645e] hover:bg-[#edf3ef] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={onClose}
              disabled={form.isSubmitting}
            >
              キャンセル
            </button>
            <button
              className="min-h-12 cursor-pointer rounded-[14px] border border-[#427f6d] bg-[#4d927c] px-4 text-xs font-black text-white shadow-sm hover:bg-[#3f806c] disabled:cursor-not-allowed disabled:border-[#bdc8c1] disabled:bg-[#d5ddd8] disabled:text-[#7d8984]"
              type="submit"
              disabled={!form.canSubmit}
            >
              {form.isSubmitting ? '保存中…' : '変更を保存'}
            </button>
          </div>

          {onSignOut && (
            <div className="mt-1 border-t border-[#d8dfd8] pt-5">
              <button
                className="min-h-12 w-full cursor-pointer rounded-[14px] border border-[#e0c3bd] bg-white px-4 text-xs font-black text-[#8b473e] hover:bg-[#fbeeeb] disabled:cursor-wait disabled:opacity-50"
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? 'ログアウト中…' : 'ログアウト'}
              </button>
              {signOutError && (
                <p
                  className="m-0 mt-2 rounded-[10px] bg-[#fde8e4] px-3 py-2.5 text-[10px] text-[#903f3c]"
                  role="alert"
                >
                  {signOutError}
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body,
  )
}
