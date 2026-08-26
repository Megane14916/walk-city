export type GetDailyStepsInput = {
  date: string
  timezone: string
}

export type DailySteps = {
  date: string
  timezone: string
  steps: number
  source: 'google_health'
  syncedAt: string
}
