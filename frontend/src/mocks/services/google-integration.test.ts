import { describe, expect, it } from 'vitest'
import { createMockGoogleIntegrationApi } from './google-integration'

const FIXED_NOW = new Date('2026-08-25T10:00:00.000Z')

describe('createMockGoogleIntegrationApi', () => {
  it('reproduces the permission-required connection state', async () => {
    const api = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initialHealthConnectionStatus: 'permission_required',
      now: () => FIXED_NOW,
    })

    const stateResult = await api.getGoogleIntegrationState()
    expect(stateResult.ok).toBe(true)
    if (stateResult.ok) {
      expect(stateResult.data.healthConnection?.status).toBe(
        'permission_required',
      )
    }

    const stepsResult = await api.getDailySteps({
      date: '2026-08-25',
      timezone: 'Australia/Sydney',
    })
    expect(stepsResult).toMatchObject({
      ok: false,
      error: { code: 'HEALTH_PERMISSION_REQUIRED' },
    })
  })

  it('uses the injected clock and daily step data', async () => {
    const api = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initialHealthConnectionStatus: 'connected',
      stepsByDate: { '2026-08-25': 12_345 },
      now: () => FIXED_NOW,
    })

    const result = await api.getDailySteps({
      date: '2026-08-25',
      timezone: 'Australia/Sydney',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        date: '2026-08-25',
        timezone: 'Australia/Sydney',
        steps: 12_345,
        source: 'google_health',
        syncedAt: FIXED_NOW.toISOString(),
      },
    })
  })

  it('clears injected failures when reset', async () => {
    const api = createMockGoogleIntegrationApi({ latencyMs: 0 })
    api.setFailure('signInWithGoogle', 'INTERNAL_ERROR')

    expect(await api.signInWithGoogle()).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    })

    api.reset()
    expect(await api.signInWithGoogle()).toMatchObject({ ok: true })
  })

  it('notifies active auth subscribers and stops after unsubscribe', async () => {
    const api = createMockGoogleIntegrationApi({ latencyMs: 0 })
    let notifications = 0
    const unsubscribe = api.subscribeToAuthChanges(() => {
      notifications += 1
    })

    await api.signInWithGoogle()
    expect(notifications).toBe(1)

    unsubscribe()
    await api.signOut()
    expect(notifications).toBe(1)
  })

  it('preserves Health connection across logout and a later login', async () => {
    const api = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initiallyHealthConnected: true,
    })

    await api.signOut()
    const signedOut = await api.getGoogleIntegrationState()
    expect(signedOut).toMatchObject({
      ok: true,
      data: { session: null, healthConnection: null },
    })

    const signedIn = await api.signInWithGoogle()
    expect(signedIn).toMatchObject({
      ok: true,
      data: { healthConnection: { status: 'connected' } },
    })
  })

  it('validates step overrides and restores them on reset', async () => {
    const api = createMockGoogleIntegrationApi({
      latencyMs: 0,
      initiallySignedIn: true,
      initiallyHealthConnected: true,
      stepsByDate: { '2026-08-25': 100 },
      now: () => FIXED_NOW,
    })

    expect(() => api.setSteps('invalid', 10)).toThrow()
    expect(() => api.setSteps('2026-08-25', -1)).toThrow()

    api.setSteps('2026-08-25', 999)
    expect(
      await api.getDailySteps({
        date: '2026-08-25',
        timezone: 'Australia/Sydney',
      }),
    ).toMatchObject({ ok: true, data: { steps: 999 } })

    api.reset()
    expect(
      await api.getDailySteps({
        date: '2026-08-25',
        timezone: 'Australia/Sydney',
      }),
    ).toMatchObject({ ok: true, data: { steps: 100 } })
  })
})
