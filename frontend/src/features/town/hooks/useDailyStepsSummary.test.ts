import { describe, expect, it } from 'vitest'
import { dateInTokyo } from './useDailyStepsSummary'

describe('dateInTokyo', () => {
  it('changes the date at midnight in Asia/Tokyo', () => {
    expect(dateInTokyo(new Date('2026-08-29T14:59:59.999Z'))).toBe(
      '2026-08-29',
    )
    expect(dateInTokyo(new Date('2026-08-29T15:00:00.000Z'))).toBe(
      '2026-08-30',
    )
  })
})
