import { useEffect, useState } from 'react'
import type { GoogleIntegrationApi } from '../../auth/api'
import type { GoogleIntegrationState } from '../../auth/types'
import type { DailySteps } from '../../health/types'

const TIMEZONE = 'Asia/Tokyo'

type DailyStepsSummaryState = {
  dailySteps: DailySteps | null
  isLoading: boolean
  isConnected: boolean
}

type LoadedDailySteps = {
  api: GoogleIntegrationApi
  dailySteps: DailySteps | null
}

export function dateInTokyo(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function useDailyStepsSummary(
  api?: GoogleIntegrationApi,
  integrationState?: GoogleIntegrationState | null,
): DailyStepsSummaryState {
  const isConnected =
    integrationState?.healthConnection?.status === 'connected'
  const [loaded, setLoaded] = useState<LoadedDailySteps | null>(null)

  useEffect(() => {
    if (!api || !isConnected) return

    let active = true
    void api
      .getDailySteps({
        date: dateInTokyo(new Date()),
        timezone: TIMEZONE,
      })
      .then((stepsResult) => {
        if (!active) return

        setLoaded({
          api,
          dailySteps: stepsResult.ok ? stepsResult.data : null,
        })
      })
      .catch(() => {
        if (active) setLoaded({ api, dailySteps: null })
      })

    return () => {
      active = false
    }
  }, [api, isConnected])

  const dailySteps =
    isConnected && loaded && loaded.api === api ? loaded.dailySteps : null
  return {
    dailySteps,
    isLoading: api !== undefined && isConnected && loaded?.api !== api,
    isConnected,
  }
}
