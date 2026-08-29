import { describe, expect, it } from 'vitest'
import { parseDailySteps } from '../../../supabase/functions/_shared/google-health-parser'

describe('Google Health v4 dailyRollUp parser', () => {
  it('reads the official rollupDataPoints and steps.countSum shape', () => {
    expect(
      parseDailySteps({
        rollupDataPoints: [
          {
            civilStartTime: {
              date: { year: 2026, month: 8, day: 29 },
              time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 },
            },
            civilEndTime: {
              date: { year: 2026, month: 8, day: 30 },
              time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 },
            },
            steps: { countSum: '12345' },
          },
        ],
      }),
    ).toBe(12_345)
  })

  it('accepts a no-data window but rejects legacy and malformed shapes', () => {
    expect(parseDailySteps({ rollupDataPoints: [{}] })).toBe(0)
    expect(() => parseDailySteps({ dataPoints: [] })).toThrow(
      'INVALID_GOOGLE_HEALTH_RESPONSE',
    )
    expect(() =>
      parseDailySteps({ rollupDataPoints: [{ steps: { countSum: '-1' } }] }),
    ).toThrow('INVALID_GOOGLE_HEALTH_RESPONSE')
  })
})
