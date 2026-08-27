import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError, ApiResult } from '../../../types/common'
import type { TownApi } from '../api'
import type {
  BuildingCatalogItem,
  PlaceBuildingInput,
  TownDetail,
  TownMutationResult,
} from '../types'

type TownOverviewData = {
  town: TownDetail
  catalog: BuildingCatalogItem[]
}

export type TownOverviewState = {
  data: TownOverviewData | null
  isLoading: boolean
  error: ApiError | null
  placeBuilding: (
    input: PlaceBuildingInput,
  ) => Promise<ApiResult<TownMutationResult>>
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

  const placeBuilding = useCallback(
    async (
      input: PlaceBuildingInput,
    ): Promise<ApiResult<TownMutationResult>> => {
      let result: ApiResult<TownMutationResult>

      try {
        result = await api.placeBuilding(input)
      } catch {
        return { ok: false, error: UNEXPECTED_ERROR }
      }

      if (!result.ok) return result

      setData((current) => {
        if (!current) return current

        const buildings = current.town.buildings.some(
          (building) => building.id === result.data.building.id,
        )
          ? current.town.buildings.map((building) =>
              building.id === result.data.building.id
                ? result.data.building
                : building,
            )
          : [...current.town.buildings, result.data.building]

        return {
          ...current,
          town: {
            ...current.town,
            town: {
              ...current.town.town,
              coins: result.data.coinBalance,
              population: result.data.population,
            },
            buildings,
          },
        }
      })

      return result
    },
    [api],
  )

  return { data, isLoading, error, placeBuilding, retry }
}
