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
})
