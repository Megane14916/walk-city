import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError, ApiResult } from '../../../types/common'
import type { StepSyncApi } from '../api'
import type { StepSyncStatus } from '../types'

export type StepSyncState = {
  latest: StepSyncStatus | null
  isSyncing: boolean
  error: ApiError | null
  sync: () => Promise<ApiResult<StepSyncStatus>>
  clearError: () => void
}

type StoredStepSyncState = {
  api: StepSyncApi | undefined
  latest: StepSyncStatus | null
  isSyncing: boolean
  error: ApiError | null
}

const UNAVAILABLE_ERROR: ApiError = {
  code: 'INTERNAL_ERROR',
  message: '歩数同期APIを利用できません。',
}

const PROVIDER_ERROR: ApiError = {
  code: 'HEALTH_PROVIDER_ERROR',
  message: 'Google Healthとの通信に失敗しました。',
}

export function useStepSync(api?: StepSyncApi): StepSyncState {
  const [stored, setStored] = useState<StoredStepSyncState>({
    api,
    latest: null,
    isSyncing: false,
    error: null,
  })
  const mounted = useRef(true)
  const generation = useRef(0)
  const inFlight = useRef<Promise<ApiResult<StepSyncStatus>> | null>(null)

  useEffect(() => {
    mounted.current = true
    generation.current += 1
    inFlight.current = null

    return () => {
      mounted.current = false
      generation.current += 1
      inFlight.current = null
    }
  }, [api])

  const sync = useCallback((): Promise<ApiResult<StepSyncStatus>> => {
    if (!api) return Promise.resolve({ ok: false, error: UNAVAILABLE_ERROR })
    if (inFlight.current) return inFlight.current

    const requestGeneration = generation.current
    setStored((current) => ({
      api,
      latest: current.api === api ? current.latest : null,
      isSyncing: true,
      error: null,
    }))

    const request = api
      .syncSteps()
      .catch((): ApiResult<StepSyncStatus> => ({
        ok: false,
        error: PROVIDER_ERROR,
      }))
      .then((result) => {
        if (mounted.current && generation.current === requestGeneration) {
          setStored((current) => ({
            api,
            latest: result.ok
              ? result.data
              : current.api === api
                ? current.latest
                : null,
            isSyncing: false,
            error: result.ok ? null : result.error,
          }))
        }
        return result
      })
      .finally(() => {
        if (inFlight.current === request) inFlight.current = null
        if (mounted.current && generation.current === requestGeneration) {
          setStored((current) =>
            current.api === api
              ? { ...current, isSyncing: false }
              : current,
          )
        }
      })

    inFlight.current = request
    return request
  }, [api])

  const clearError = useCallback(() => {
    setStored((current) =>
      current.api === api ? { ...current, error: null } : current,
    )
  }, [api])

  const isCurrentApi = stored.api === api

  return {
    latest: isCurrentApi ? stored.latest : null,
    isSyncing: isCurrentApi ? stored.isSyncing : false,
    error: isCurrentApi ? stored.error : null,
    sync,
    clearError,
  }
}
