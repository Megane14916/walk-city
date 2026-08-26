import { useEffect, useState } from 'react'
import type { GoogleIntegrationApi } from '../../auth/api'
import type { DailySteps } from '../../health/types'

const TIMEZONE = 'Australia/Sydney'

type DailyStepsSummaryState = {
  dailySteps: DailySteps | null
  isLoading: boolean
  isConnected: boolean
}

function todayInSydney(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function useDailyStepsSummary(
  api?: GoogleIntegrationApi,
): DailyStepsSummaryState {
  const [state, setState] = useState<DailyStepsSummaryState>({
    dailySteps: null,
    isLoading: api !== undefined,
    isConnected: false,
  })

  useEffect(() => {
    let active = true

    if (!api) return

    void api
      .getGoogleIntegrationState()
      .then(async (stateResult) => {
        if (!active) return
        const isConnected =
          stateResult.ok &&
          stateResult.data.healthConnection?.status === 'connected'

        if (!isConnected) {
          setState({
            dailySteps: null,
            isLoading: false,
            isConnected: false,
          })
          return
        }

        const stepsResult = await api.getDailySteps({
          date: todayInSydney(),
          timezone: TIMEZONE,
        })
        if (!active) return

        setState({
          dailySteps: stepsResult.ok ? stepsResult.data : null,
          isLoading: false,
          isConnected: true,
        })
      })
      .catch(() => {
        if (active) {
          setState({
            dailySteps: null,
            isLoading: false,
            isConnected: false,
          })
        }
      })

    return () => {
      active = false
    }
  }, [api])

  return state
}
