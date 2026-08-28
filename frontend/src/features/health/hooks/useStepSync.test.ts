// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '../../../types/common'
import type { StepSyncApi } from '../api'
import type { StepSyncStatus } from '../types'
import { useStepSync } from './useStepSync'

const STATUS: StepSyncStatus = {
  date: '2026-08-27',
  timezone: 'Asia/Tokyo',
  steps: 6_500,
  newlyRewardedSteps: 1_500,
  coinsAwarded: 150,
  coinBalance: 850,
  appliedBonuses: [],
  syncedAt: '2026-08-27T12:00:00+09:00',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useStepSync', () => {
  it('stores a successful result', async () => {
    const api: StepSyncApi = {
      syncSteps: vi.fn().mockResolvedValue({ ok: true, data: STATUS }),
    }
    const { result } = renderHook(() => useStepSync(api))

    await act(() => result.current.sync())

    expect(result.current.latest).toEqual(STATUS)
    expect(result.current.error).toBeNull()
    expect(result.current.isSyncing).toBe(false)
  })

  it('reuses the in-flight request for consecutive calls', async () => {
    let resolveRequest!: (value: ApiResult<StepSyncStatus>) => void
    const pending = new Promise<ApiResult<StepSyncStatus>>((resolve) => {
      resolveRequest = resolve
    })
    const syncSteps = vi.fn().mockReturnValue(pending)
    const api: StepSyncApi = { syncSteps }
    const { result } = renderHook(() => useStepSync(api))

    let first!: Promise<ApiResult<StepSyncStatus>>
    let second!: Promise<ApiResult<StepSyncStatus>>
    act(() => {
      first = result.current.sync()
      second = result.current.sync()
    })

    expect(first).toBe(second)
    expect(syncSteps).toHaveBeenCalledTimes(1)
    expect(result.current.isSyncing).toBe(true)

    await act(async () => {
      resolveRequest({ ok: true, data: STATUS })
      await first
    })
  })

  it('keeps the previous success when a later request fails', async () => {
    const syncSteps = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: STATUS })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'HEALTH_PROVIDER_ERROR', message: '同期失敗' },
      })
    const api: StepSyncApi = { syncSteps }
    const { result } = renderHook(() => useStepSync(api))

    await act(() => result.current.sync())
    await act(() => result.current.sync())

    expect(result.current.latest).toEqual(STATUS)
    expect(result.current.error).toMatchObject({
      code: 'HEALTH_PROVIDER_ERROR',
    })

    act(() => result.current.clearError())
    expect(result.current.error).toBeNull()
  })

  it('normalizes a rejected API call', async () => {
    const api: StepSyncApi = {
      syncSteps: vi.fn().mockRejectedValue(new Error('network detail')),
    }
    const { result } = renderHook(() => useStepSync(api))

    await act(() => result.current.sync())

    expect(result.current.error).toEqual({
      code: 'HEALTH_PROVIDER_ERROR',
      message: 'Google Healthとの通信に失敗しました。',
    })
  })

  it('does not apply a response from the previous API instance', async () => {
    let resolveRequest!: (value: ApiResult<StepSyncStatus>) => void
    const previousApi: StepSyncApi = {
      syncSteps: () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        }),
    }
    const nextApi: StepSyncApi = {
      syncSteps: vi.fn().mockResolvedValue({ ok: true, data: STATUS }),
    }
    const { result, rerender } = renderHook(
      ({ api }: { api: StepSyncApi }) => useStepSync(api),
      { initialProps: { api: previousApi } },
    )

    act(() => {
      void result.current.sync()
    })
    rerender({ api: nextApi })
    await act(async () => {
      resolveRequest({ ok: true, data: STATUS })
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.isSyncing).toBe(false))
    expect(result.current.latest).toBeNull()
  })
})
