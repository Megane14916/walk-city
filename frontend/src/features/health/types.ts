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

export type AppliedBonus = {
  sourceBuildingType: string
  sourceCount: number
  effectType: string
  amount: number
}

export type StepSyncStatus = {
  date: string
  timezone: string
  steps: number
  newlyRewardedSteps: number
  coinsAwarded: number
  coinBalance: number
  appliedBonuses: AppliedBonus[]
  syncedAt: string
}
