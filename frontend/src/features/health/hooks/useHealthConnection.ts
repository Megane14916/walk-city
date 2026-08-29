import { useCallback, useEffect, useState } from 'react'
import { useApi } from '../../../app/providers'
import { useAuth } from '../../auth/hooks'
import type { GoogleHealthConnection } from '../../auth/types'
import type { DailySteps } from '../types'

const TIMEZONE = 'Asia/Tokyo'

export type HealthConnectionPendingAction =
  | 'connecting'
  | 'syncing'
  | 'disconnecting'
  | null

function todayInTokyo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function useHealthConnection() {
  const { googleIntegrationApi } = useApi()
  const { integrationState, refresh } = useAuth()
  const [today] = useState(todayInTokyo)
  const [dailySteps, setDailySteps] = useState<DailySteps | null>(null)
  const [pending, setPending] =
    useState<HealthConnectionPendingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const connection = integrationState?.healthConnection ?? null

  const clearMessages = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  const loadDailySteps = useCallback(async () => {
    const result = await googleIntegrationApi.getDailySteps({
      date: today,
      timezone: TIMEZONE,
    })
    if (result.ok) setDailySteps(result.data)
    else setError(result.error.message)
    return result
  }, [googleIntegrationApi, today])

  useEffect(() => {
    if (connection?.status !== 'connected') return

    let active = true
    void googleIntegrationApi
      .getDailySteps({ date: today, timezone: TIMEZONE })
      .then((result) => {
        if (!active) return
        if (result.ok) setDailySteps(result.data)
        else setError(result.error.message)
      })
      .catch(() => {
        if (active) setError('今日の歩数を取得できませんでした。')
      })

    return () => {
      active = false
    }
  }, [connection?.status, googleIntegrationApi, today])

  const connect = useCallback(async () => {
    if (pending) return

    clearMessages()
    setPending('connecting')
    try {
      const result = await googleIntegrationApi.startGoogleHealthConnection()
      if (!result.ok) {
        setError(result.error.message)
        return
      }

      if (result.data.next === 'redirect') {
        globalThis.location.assign(result.data.authorizationUrl)
        return
      }

      const refreshed = await refresh()
      if (!refreshed.ok) return
      setNotice('Google Healthとの連携が完了しました。')
    } catch {
      setError('Google Healthとの連携を開始できませんでした。')
    } finally {
      setPending(null)
    }
  }, [clearMessages, googleIntegrationApi, pending, refresh])

  const sync = useCallback(async () => {
    if (pending) return

    clearMessages()
    setPending('syncing')
    try {
      const result = await loadDailySteps()
      if (result.ok) {
        setNotice('今日の歩数を更新しました。')
        await refresh()
      }
    } catch {
      setError('今日の歩数を更新できませんでした。')
    } finally {
      setPending(null)
    }
  }, [clearMessages, loadDailySteps, pending, refresh])

  const disconnect = useCallback(async () => {
    if (pending) return

    clearMessages()
    setPending('disconnecting')
    try {
      const result = await googleIntegrationApi.disconnectGoogleHealth()
      if (!result.ok) {
        setError(result.error.message)
        return
      }

      const refreshed = await refresh()
      if (!refreshed.ok) return
      setDailySteps(null)
      setNotice('Google Healthの連携を解除しました。')
    } catch {
      setError('Google Healthの連携を解除できませんでした。')
    } finally {
      setPending(null)
    }
  }, [clearMessages, googleIntegrationApi, pending, refresh])

  return {
    connection: connection as GoogleHealthConnection | null,
    dailySteps,
    today,
    pending,
    error,
    notice,
    connect,
    sync,
    disconnect,
  }
}
