import { describe, expect, it, vi } from 'vitest'
import { toPublicUserProfile } from '../../features/user/utils'
import {
  MOCK_PUBLIC_EDITABLE_USER_ID,
  MOCK_PUBLIC_INVALID_POPULATION_USER_ID,
  MOCK_PUBLIC_LARGE_POPULATION_USER_ID,
  MOCK_PUBLIC_LONG_NAME_USER_ID,
  MOCK_PUBLIC_OWNER_MISMATCH_USER_ID,
  MOCK_PUBLIC_USER_ID,
  MOCK_PUBLIC_ZERO_POPULATION_USER_ID,
} from '../data/towns'
import { createMockTownApi } from './town'

describe('public user town mock scenarios', () => {
  it.each([
    [MOCK_PUBLIC_USER_ID, 50],
    [MOCK_PUBLIC_LONG_NAME_USER_ID, 123_456],
    [MOCK_PUBLIC_ZERO_POPULATION_USER_ID, 0],
    [MOCK_PUBLIC_LARGE_POPULATION_USER_ID, Number.MAX_SAFE_INTEGER],
  ])('returns a valid public profile fixture for %s', async (userId, population) => {
    const api = createMockTownApi({ latencyMs: 0 })

    const result = await api.getPublicTown(userId)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.town.population).toBe(population)
    expect(result.data.town.coins).toBeUndefined()
    expect(result.data.editable).toBe(false)
    expect(toPublicUserProfile(userId, result.data).ok).toBe(true)
  })

  it('returns long names without truncating the fixture data', async () => {
    const api = createMockTownApi({ latencyMs: 0 })

    const result = await api.getPublicTown(MOCK_PUBLIC_LONG_NAME_USER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.town.owner.displayName.length).toBeGreaterThan(20)
    expect(result.data.town.name.length).toBeGreaterThan(20)
  })

  it('returns NOT_FOUND for an unknown user', async () => {
    const api = createMockTownApi({ latencyMs: 0 })

    await expect(api.getPublicTown('missing-user')).resolves.toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: '対象が見つかりません。',
      },
    })
  })

  it.each(['UNAUTHENTICATED', 'INTERNAL_ERROR'] as const)(
    'injects a %s result for getPublicTown',
    async (code) => {
      const api = createMockTownApi({ latencyMs: 0 })
      api.setFailure('getPublicTown', code)

      const result = await api.getPublicTown(MOCK_PUBLIC_USER_ID)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe(code)
    },
  )

  it('injects a rejected getPublicTown request', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    api.setException('getPublicTown', true)

    await expect(api.getPublicTown(MOCK_PUBLIC_USER_ID)).rejects.toThrow(
      'Mock getPublicTown exception',
    )
  })

  it('supports a delayed public profile response', async () => {
    vi.useFakeTimers()
    try {
      const api = createMockTownApi({ latencyMs: 500 })
      let settled = false
      const request = api.getPublicTown(MOCK_PUBLIC_USER_ID).then((result) => {
        settled = true
        return result
      })

      await Promise.resolve()
      expect(settled).toBe(false)

      await vi.advanceTimersByTimeAsync(500)
      await expect(request).resolves.toMatchObject({ ok: true })
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    ['owner mismatch', MOCK_PUBLIC_OWNER_MISMATCH_USER_ID],
    ['editable response', MOCK_PUBLIC_EDITABLE_USER_ID],
    ['invalid population', MOCK_PUBLIC_INVALID_POPULATION_USER_ID],
  ])('reproduces and detects the %s contract violation', async (_label, userId) => {
    const api = createMockTownApi({ latencyMs: 0 })

    const result = await api.getPublicTown(userId)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const profileResult = toPublicUserProfile(userId, result.data)
    expect(profileResult.ok).toBe(false)
    if (profileResult.ok) return
    expect(profileResult.error.code).toBe('INTERNAL_ERROR')
  })

  it('returns copies so a consumer cannot mutate later responses', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    const first = await api.getPublicTown(MOCK_PUBLIC_USER_ID)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    first.data.town.owner.displayName = '変更済み'
    first.data.buildings.length = 0

    const second = await api.getPublicTown(MOCK_PUBLIC_USER_ID)

    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.data.town.owner.displayName).toBe('シティウォーカー')
    expect(second.data.buildings.length).toBeGreaterThan(0)
  })

  it('clears injected failures and exceptions on reset', async () => {
    const api = createMockTownApi({ latencyMs: 0 })
    api.setFailure('getPublicTown', 'UNAUTHENTICATED')
    api.setException('getPublicTown', true)

    api.reset()

    const result = await api.getPublicTown(MOCK_PUBLIC_USER_ID)
    expect(result.ok).toBe(true)
  })
})
