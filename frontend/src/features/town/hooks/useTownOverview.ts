import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError } from '../../../types/common'
import type { TownApi } from '../api'
import type { BuildingCatalogItem, TownDetail } from '../types'

type TownOverviewData = {
  town: TownDetail
  catalog: BuildingCatalogItem[]
}

export type TownOverviewState = {
  data: TownOverviewData | null
  isLoading: boolean
  error: ApiError | null
  retry: () => void
}

const UNEXPECTED_ERROR: ApiError = {
  code: 'INTERNAL_ERROR',
  message: '街のデータを読み込めませんでした。',
}

export function useTownOverview(api: TownApi): TownOverviewState {
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<TownOverviewData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const requestGeneration = useRef(0)

  useEffect(() => {
    let active = true
    const generation = requestGeneration.current + 1
    requestGeneration.current = generation

    void Promise.all([api.getMyTown(), api.getBuildingCatalog()])
      .then(([townResult, catalogResult]) => {
        if (!active || generation !== requestGeneration.current) return

        if (!townResult.ok) {
          setError(townResult.error)
          return
        }
        if (!catalogResult.ok) {
          setError(catalogResult.error)
          return
        }

        setData({ town: townResult.data, catalog: catalogResult.data })
      })
      .catch(() => {
        if (active && generation === requestGeneration.current) {
          setError(UNEXPECTED_ERROR)
        }
      })
      .finally(() => {
        if (active && generation === requestGeneration.current) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [api, attempt])

  const retry = useCallback(() => {
    setData(null)
    setIsLoading(true)
    setError(null)
    setAttempt((current) => current + 1)
  }, [])

  return { data, isLoading, error, retry }
}
