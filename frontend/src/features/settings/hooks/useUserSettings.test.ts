// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SettingsApi } from '../api'
import type { UserSettings } from '../types'
import { createMockSettingsApi } from '../../../mocks/services/settings'
import type { ApiResult } from '../../../types/common'
import { useUserSettings } from './useUserSettings'

describe('useUserSettings', () => {
  it('starts clean and enables submit only for valid changes', () => {
    const api = createMockSettingsApi({ latencyMs: 0 })
    const { result } = renderHook(() =>
      useUserSettings({
        api,
        initialSettings: { displayName: '利用者', townName: '街' },
      }),
    )

    expect(result.current.isDirty).toBe(false)
    expect(result.current.canSubmit).toBe(false)

    act(() => result.current.setDisplayName('新しい利用者'))
    expect(result.current.isDirty).toBe(true)
    expect(result.current.canSubmit).toBe(true)

    act(() => result.current.setTownName(''))
    expect(result.current.errors.townName).toBeDefined()
    expect(result.current.canSubmit).toBe(false)
  })

  it('preserves input after an API error and succeeds on retry', async () => {
    const api = createMockSettingsApi({ latencyMs: 0 })
    api.setFailure('INTERNAL_ERROR')
    const { result } = renderHook(() =>
      useUserSettings({
        api,
        initialSettings: { displayName: '利用者', townName: '街' },
      }),
    )
    act(() => result.current.setDisplayName('保存対象'))

    await act(async () => {
      expect(await result.current.submit()).toBeNull()
    })
    expect(result.current.values.displayName).toBe('保存対象')
    expect(result.current.apiError?.code).toBe('INTERNAL_ERROR')

    await act(async () => {
      expect(await result.current.submit()).toMatchObject({
        displayName: '保存対象',
      })
    })
    expect(result.current.apiError).toBeNull()
  })

  it('prevents duplicate submissions while a request is pending', async () => {
    let resolveRequest:
      | ((value: ApiResult<UserSettings>) => void)
      | undefined
    const api: SettingsApi = {
      updateUserSettings: vi.fn<SettingsApi['updateUserSettings']>(
        () =>
          new Promise<ApiResult<UserSettings>>((resolve) => {
            resolveRequest = resolve
          }),
      ),
    }
    const { result } = renderHook(() =>
      useUserSettings({
        api,
        initialSettings: { displayName: '利用者', townName: '街' },
      }),
    )
    act(() => result.current.setDisplayName('変更後'))

    let first: Promise<unknown>
    await act(async () => {
      first = result.current.submit()
      expect(await result.current.submit()).toBeNull()
    })
    expect(api.updateUserSettings).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveRequest?.({
        ok: true,
        data: {
          displayName: '変更後',
          townName: '街',
          updatedAt: '2026-08-30T00:00:00.000Z',
        },
      })
      await first!
    })
    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })
})
