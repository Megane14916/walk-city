import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError, ApiResult } from '../../../types/common'
import type { TownApi } from '../api'
import type {
  BuildingCatalogItem,
  DeleteRoadInput,
  DeleteRoadResult,
  PlaceBuildingInput,
  PlaceRoadLineInput,
  PlaceRoadLineResult,
  RenameBuildingInput,
  RenameBuildingResult,
  TownDetail,
  TownMutationResult,
  UnlockLandInput,
  UnlockLandResult,
} from '../types'
import type { StepSyncStatus } from '../../health/types'

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
  placeRoadLine: (
    input: PlaceRoadLineInput,
  ) => Promise<ApiResult<PlaceRoadLineResult>>
  unlockLand: (
    input: UnlockLandInput,
  ) => Promise<ApiResult<UnlockLandResult>>
  renameBuilding: (
    input: RenameBuildingInput,
  ) => Promise<ApiResult<RenameBuildingResult>>
  deleteRoad: (
    input: DeleteRoadInput,
  ) => Promise<ApiResult<DeleteRoadResult>>
  applyStepSyncResult: (result: StepSyncStatus) => void
  retry: () => void
}

export type TownPageMode =
  | { type: 'self' }
  | { type: 'public'; userId: string }

const SELF_MODE: TownPageMode = { type: 'self' }

const UNEXPECTED_ERROR: ApiError = {
  code: 'INTERNAL_ERROR',
  message: '街のデータを読み込めませんでした。',
}

export function useTownOverview(
  api: TownApi,
  mode: TownPageMode = SELF_MODE,
): TownOverviewState {
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<TownOverviewData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null)
  const requestGeneration = useRef(0)
  const publicUserId = mode.type === 'public' ? mode.userId : null
  const requestKey = publicUserId === null ? 'self' : `public:${publicUserId}`

  useEffect(() => {
    let active = true
    const generation = requestGeneration.current + 1
    requestGeneration.current = generation

    const townRequest = publicUserId
      ? api.getPublicTown(publicUserId)
      : api.getMyTown()

    void Promise.all([townRequest, api.getBuildingCatalog()])
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
          setLoadedRequestKey(requestKey)
        }
      })

    return () => {
      active = false
    }
  }, [api, attempt, publicUserId, requestKey])

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

  const applyStepSyncResult = useCallback((result: StepSyncStatus) => {
    setData((current) => {
      if (!current || current.town.editable !== true) return current

      return {
        ...current,
        town: {
          ...current.town,
          town: {
            ...current.town.town,
            coins: result.coinBalance,
          },
        },
      }
    })
  }, [])

  const placeRoadLine = useCallback(
    async (
      input: PlaceRoadLineInput,
    ): Promise<ApiResult<PlaceRoadLineResult>> => {
      let result: ApiResult<PlaceRoadLineResult>

      try {
        result = await api.placeRoadLine(input)
      } catch {
        return { ok: false, error: UNEXPECTED_ERROR }
      }

      if (!result.ok) return result

      setData((current) => {
        if (!current || current.town.editable !== true) return current
        const existingIds = new Set(
          current.town.buildings.map((building) => building.id),
        )
        const newBuildings = result.data.buildings.filter(
          (building) => !existingIds.has(building.id),
        )

        return {
          ...current,
          town: {
            ...current.town,
            town: {
              ...current.town.town,
              coins: result.data.coinBalance,
              population: result.data.population,
            },
            buildings: [...current.town.buildings, ...newBuildings],
          },
        }
      })

      return result
    },
    [api],
  )

  const unlockLand = useCallback(
    async (input: UnlockLandInput): Promise<ApiResult<UnlockLandResult>> => {
      let result: ApiResult<UnlockLandResult>

      try {
        result = await api.unlockLand(input)
      } catch {
        return { ok: false, error: UNEXPECTED_ERROR }
      }

      if (!result.ok) return result

      setData((current) => {
        if (!current || current.town.editable !== true) return current

        const areaExists = current.town.unlockedAreas.some(
          (area) =>
            area.x === result.data.unlockedArea.x &&
            area.y === result.data.unlockedArea.y,
        )

        return {
          ...current,
          town: {
            ...current.town,
            town: {
              ...current.town.town,
              coins: result.data.coinBalance,
            },
            unlockedAreas: areaExists
              ? current.town.unlockedAreas
              : [...current.town.unlockedAreas, result.data.unlockedArea],
          },
        }
      })

      return result
    },
    [api],
  )

  const renameBuilding = useCallback(
    async (
      input: RenameBuildingInput,
    ): Promise<ApiResult<RenameBuildingResult>> => {
      let result: ApiResult<RenameBuildingResult>

      try {
        result = await api.renameBuilding(input)
      } catch {
        return { ok: false, error: UNEXPECTED_ERROR }
      }

      if (!result.ok) return result

      setData((current) => {
        if (!current || current.town.editable !== true) return current
        return {
          ...current,
          town: {
            ...current.town,
            buildings: current.town.buildings.map((building) =>
              building.id === result.data.building.id
                ? result.data.building
                : building,
            ),
          },
        }
      })

      return result
    },
    [api],
  )

  const deleteRoad = useCallback(
    async (input: DeleteRoadInput): Promise<ApiResult<DeleteRoadResult>> => {
      let result: ApiResult<DeleteRoadResult>

      try {
        result = await api.deleteRoad(input)
      } catch {
        return { ok: false, error: UNEXPECTED_ERROR }
      }

      if (!result.ok) return result

      setData((current) => {
        if (!current || current.town.editable !== true) return current
        const deletedIds = new Set(result.data.deletedBuildingIds)
        return {
          ...current,
          town: {
            ...current.town,
            town: {
              ...current.town.town,
              coins: result.data.coinBalance,
              population: result.data.population,
            },
            buildings: current.town.buildings.filter(
              (building) => !deletedIds.has(building.id),
            ),
          },
        }
      })

      return result
    },
    [api],
  )

  const isCurrentRequest = loadedRequestKey === requestKey
  return {
    data: isCurrentRequest ? data : null,
    isLoading: !isCurrentRequest || isLoading,
    error: isCurrentRequest ? error : null,
    placeBuilding,
    placeRoadLine,
    unlockLand,
    renameBuilding,
    deleteRoad,
    applyStepSyncResult,
    retry,
  }
}
