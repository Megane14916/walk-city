// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMockSettingsApi } from '../../../mocks/services/settings'
import { UserSettingsDialog } from './UserSettingsDialog'

afterEach(() => cleanup())

describe('UserSettingsDialog', () => {
  it('shows current public values and focuses the user name', () => {
    render(
      <UserSettingsDialog
        api={createMockSettingsApi({ latencyMs: 0 })}
        displayName="現在の利用者"
        townName="現在の街"
        loginHref="/login"
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: '設定' })).not.toBeNull()
    const displayNameInput = screen.getByLabelText(
      'ユーザー名',
    ) as HTMLInputElement
    expect(displayNameInput.value).toBe('現在の利用者')
    expect((screen.getByLabelText('街の名前') as HTMLInputElement).value).toBe(
      '現在の街',
    )
    expect(document.activeElement).toBe(displayNameInput)
    expect(
      (screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('validates each field and keeps the save action disabled', () => {
    render(
      <UserSettingsDialog
        api={createMockSettingsApi({ latencyMs: 0 })}
        displayName="利用者"
        townName="街"
        loginHref="/login"
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('ユーザー名'), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByLabelText('街の名前'), {
      target: { value: '街'.repeat(31) },
    })

    expect(screen.getByText('ユーザー名を入力してください。')).not.toBeNull()
    expect(
      screen.getByText('街の名前は30文字以内で入力してください。'),
    ).not.toBeNull()
    expect(screen.getByLabelText('ユーザー名').getAttribute('aria-invalid')).toBe(
      'true',
    )
    expect(
      (screen.getByRole('button', { name: '変更を保存' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('submits normalized values once and returns the saved result', async () => {
    const api = createMockSettingsApi({ latencyMs: 0 })
    const update = vi.spyOn(api, 'updateUserSettings')
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(
      <UserSettingsDialog
        api={api}
        displayName="利用者"
        townName="街"
        loginHref="/login"
        onSaved={onSaved}
        onClose={onClose}
      />,
    )

    fireEvent.change(screen.getByLabelText('ユーザー名'), {
      target: { value: '  新しい利用者  ' },
    })
    fireEvent.change(screen.getByLabelText('街の名前'), {
      target: { value: '  新しい街  ' },
    })
    fireEvent.submit(screen.getByRole('button', { name: '変更を保存' }).closest('form')!)

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({
      displayName: '新しい利用者',
      townName: '新しい街',
    })
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: '新しい利用者',
        townName: '新しい街',
      }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps values open after an API error and succeeds on retry', async () => {
    const api = createMockSettingsApi({ latencyMs: 0 })
    api.setFailure('INTERNAL_ERROR')
    const onSaved = vi.fn()
    render(
      <UserSettingsDialog
        api={api}
        displayName="利用者"
        townName="街"
        loginHref="/login"
        onSaved={onSaved}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('ユーザー名'), {
      target: { value: '保存対象' },
    })

    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      '設定を保存できませんでした。',
    )
    expect((screen.getByLabelText('ユーザー名') as HTMLInputElement).value).toBe(
      '保存対象',
    )

    fireEvent.click(screen.getByRole('button', { name: '変更を保存' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('closes with Escape and restores focus to the opener', () => {
    const onClose = vi.fn()
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { unmount } = render(
      <UserSettingsDialog
        api={createMockSettingsApi({ latencyMs: 0 })}
        displayName="利用者"
        townName="街"
        loginHref="/login"
        onSaved={vi.fn()}
        onClose={onClose}
      />,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('traps focus and does not close from a backdrop click', () => {
    const onClose = vi.fn()
    render(
      <UserSettingsDialog
        api={createMockSettingsApi({ latencyMs: 0 })}
        displayName="利用者"
        townName="街"
        loginHref="/login"
        onSaved={vi.fn()}
        onClose={onClose}
      />,
    )

    const closeButton = screen.getByRole('button', { name: '設定を閉じる' })
    const cancelButton = screen.getByRole('button', { name: 'キャンセル' })
    cancelButton.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(cancelButton)

    fireEvent.click(screen.getByTestId('settings-backdrop'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not show a logout button when onSignOut is not provided', () => {
    render(
      <UserSettingsDialog
        api={createMockSettingsApi({ latencyMs: 0 })}
        displayName="利用者"
        townName="街"
        loginHref="/login"
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'ログアウト' })).toBeNull()
  })

  it('signs out and surfaces an error message on failure', async () => {
    const onSignOut = vi
      .fn()
      .mockResolvedValue({ ok: false, error: { message: 'ログアウトに失敗しました。' } })
    render(
      <UserSettingsDialog
        api={createMockSettingsApi({ latencyMs: 0 })}
        displayName="利用者"
        townName="街"
        loginHref="/login"
        onSaved={vi.fn()}
        onClose={vi.fn()}
        onSignOut={onSignOut}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
    expect((await screen.findByRole('alert')).textContent).toContain(
      'ログアウトに失敗しました。',
    )
  })

  it('calls onSignOut when the logout button is clicked', async () => {
    const onSignOut = vi.fn().mockResolvedValue({ ok: true, data: null })
    render(
      <UserSettingsDialog
        api={createMockSettingsApi({ latencyMs: 0 })}
        displayName="利用者"
        townName="街"
        loginHref="/login"
        onSaved={vi.fn()}
        onClose={vi.fn()}
        onSignOut={onSignOut}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }))
    await waitFor(() => expect(onSignOut).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
