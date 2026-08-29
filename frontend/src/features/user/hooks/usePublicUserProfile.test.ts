// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '../../../types/common'
import type { TownDetail } from '../../town/types'
import { FIXED_MAP_LAYOUT } from '../../../mocks/data/map-layout'
import {
  usePublicUserProfile,
  type PublicUserApi,
} from './usePublicUserProfile'

function createPublicTown(
  userId: string,
  displayName = '街歩きユーザー',
): TownDetail {
  return {
    town: {
      id: `town-${userId}`,
      owner: { id: userId, displayName },
      name: `${displayName}の街`,
      population: 1_234,
      mapWidth: 100,
      mapHeight: 100,
    },
    buildings: [],
    unlockedAreas: [],
    obstacles: [],
    mapLayout: FIXED_MAP_LAYOUT,
    catalogVersion: 1,
    editable: false,
  }
}

function success(data: TownDetail): ApiResult<TownDetail> {
  return { ok: true, data }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('usePublicUserProfile', () => {
  it('loads and converts a public town into a profile', async () => {
    const getPublicTown = vi
      .fn<PublicUserApi['getPublicTown']>()
      .mockResolvedValue(success(createPublicTown('user-001')))
    const api: PublicUserApi = { getPublicTown }
    const { result } = renderHook(() =>
      usePublicUserProfile(api, 'user-001'),
    )

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(getPublicTown).toHaveBeenCalledWith('user-001')
    expect(getPublicTown).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeNull()
    expect(result.current.profile).toEqual({
      id: 'user-001',
      displayName: '街歩きユーザー',
      town: {
        id: 'town-user-001',
        name: '街歩きユーザーの街',
        population: 1_234,
      },
    })
  })

  it.each([
    ['NOT_FOUND', 'ユーザーが見つかりません。'],
    ['UNAUTHENTICATED', 'ログインが必要です。'],
    ['INTERNAL_ERROR', '取得に失敗しました。'],
  ] as const)('keeps a %s API error', async (code, message) => {
    const api: PublicUserApi = {
      getPublicTown: vi.fn().mockResolvedValue({
        ok: false,
        error: { code, message },
      }),
    }
    const { result } = renderHook(() =>
      usePublicUserProfile(api, 'user-001'),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.profile).toBeNull()
    expect(result.current.error).toEqual({ code, message })
  })

  it('normalizes a rejected request without exposing its details', async () => {
    const api: PublicUserApi = {
      getPublicTown: vi
        .fn()
        .mockRejectedValue(new Error('private network details')),
    }
    const { result } = renderHook(() =>
      usePublicUserProfile(api, 'user-001'),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.profile).toBeNull()
    expect(result.current.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'ユーザー情報を読み込めませんでした。',
    })
  })

  it('retries the same user after a failed request', async () => {
    const getPublicTown = vi
      .fn<PublicUserApi['getPublicTown']>()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: '一時的な失敗' },
      })
      .mockResolvedValueOnce(success(createPublicTown('user-001')))
    const api: PublicUserApi = { getPublicTown }
    const { result } = renderHook(() =>
      usePublicUserProfile(api, 'user-001'),
    )

    await waitFor(() =>
      expect(result.current.error?.code).toBe('INTERNAL_ERROR'),
    )
    await act(() => result.current.retry())

    expect(getPublicTown).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()
    expect(result.current.profile?.id).toBe('user-001')
  })

  it('reuses an in-flight retry request', async () => {
    const pendingRetry = deferred<ApiResult<TownDetail>>()
    const getPublicTown = vi
      .fn<PublicUserApi['getPublicTown']>()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: '一時的な失敗' },
      })
      .mockReturnValueOnce(pendingRetry.promise)
    const api: PublicUserApi = { getPublicTown }
    const { result } = renderHook(() =>
      usePublicUserProfile(api, 'user-001'),
    )
    await waitFor(() => expect(result.current.error).not.toBeNull())

    let first!: Promise<void>
    let second!: Promise<void>
    act(() => {
      first = result.current.retry()
      second = result.current.retry()
    })

    expect(first).toBe(second)
    await waitFor(() => expect(getPublicTown).toHaveBeenCalledTimes(2))

    await act(async () => {
      pendingRetry.resolve(success(createPublicTown('user-001')))
      await first
    })
  })

  it('clears the previous profile immediately when the user changes', async () => {
    const nextRequest = deferred<ApiResult<TownDetail>>()
    const api: PublicUserApi = {
      getPublicTown: vi
        .fn<PublicUserApi['getPublicTown']>()
        .mockResolvedValueOnce(success(createPublicTown('user-001')))
        .mockReturnValueOnce(nextRequest.promise),
    }
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string }) =>
        usePublicUserProfile(api, userId),
      { initialProps: { userId: 'user-001' } },
    )
    await waitFor(() => expect(result.current.profile?.id).toBe('user-001'))

    rerender({ userId: 'user-002' })

    expect(result.current.profile).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      nextRequest.resolve(success(createPublicTown('user-002')))
      await nextRequest.promise
    })
    expect(result.current.profile?.id).toBe('user-002')
  })

  it('does not let an old response overwrite the current user', async () => {
    const oldRequest = deferred<ApiResult<TownDetail>>()
    const newRequest = deferred<ApiResult<TownDetail>>()
    const api: PublicUserApi = {
      getPublicTown: vi
        .fn<PublicUserApi['getPublicTown']>()
        .mockReturnValueOnce(oldRequest.promise)
        .mockReturnValueOnce(newRequest.promise),
    }
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string }) =>
        usePublicUserProfile(api, userId),
      { initialProps: { userId: 'user-001' } },
    )

    await waitFor(() =>
      expect(api.getPublicTown).toHaveBeenCalledWith('user-001'),
    )
    rerender({ userId: 'user-002' })
    await waitFor(() =>
      expect(api.getPublicTown).toHaveBeenCalledWith('user-002'),
    )

    await act(async () => {
      newRequest.resolve(success(createPublicTown('user-002')))
      await newRequest.promise
    })
    expect(result.current.profile?.id).toBe('user-002')

    await act(async () => {
      oldRequest.resolve(success(createPublicTown('user-001')))
      await oldRequest.promise
    })
    expect(result.current.profile?.id).toBe('user-002')
  })

  it('does not request an empty user ID', async () => {
    const getPublicTown = vi.fn<PublicUserApi['getPublicTown']>()
    const api: PublicUserApi = { getPublicTown }
    const { result } = renderHook(() =>
      usePublicUserProfile(api, '   '),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(getPublicTown).not.toHaveBeenCalled()
    expect(result.current.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'ユーザーを特定できませんでした。',
    })
  })

  it('rejects a successful response that violates the public contract', async () => {
    const api: PublicUserApi = {
      getPublicTown: vi
        .fn()
        .mockResolvedValue(success(createPublicTown('different-user'))),
    }
    const { result } = renderHook(() =>
      usePublicUserProfile(api, 'user-001'),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.profile).toBeNull()
    expect(result.current.error?.code).toBe('INTERNAL_ERROR')
  })

  it('does not apply a response after unmount', async () => {
    const request = deferred<ApiResult<TownDetail>>()
    const api: PublicUserApi = {
      getPublicTown: vi.fn().mockReturnValue(request.promise),
    }
    const rendered = renderHook(() =>
      usePublicUserProfile(api, 'user-001'),
    )

    await waitFor(() => expect(api.getPublicTown).toHaveBeenCalledTimes(1))
    rendered.unmount()
    request.resolve(success(createPublicTown('user-001')))
    await request.promise

    expect(api.getPublicTown).toHaveBeenCalledTimes(1)
  })
})
