import { useMemo, useState } from 'react'
import type { GoogleIntegrationApi } from '../../auth/api'
import type { GoogleIntegrationState } from '../../auth/types'
import type { StepSyncApi } from '../../health/api'
import { useStepSync } from '../../health/hooks'
import {
  MARKET_ITEMS,
  LandUnlockControls,
  MarketList,
  PlacementControls,
  RoadPlacementControls,
  type MarketItem,
} from '../../market'
import type { RankingApi } from '../../ranking/api'
import { PopulationRanking } from '../../ranking/components'
import type { TownApi } from '../api'
import {
  useDailyStepsSummary,
  useTownOverview,
  type TownPageMode,
} from '../hooks'
import type {
  BuildingCatalogItem,
  Cell,
  PlacedBuilding,
  UnlockedArea,
} from '../types'
import {
  evaluateLandUnlockPreview,
  evaluatePlacementPreview,
  evaluateRoadLinePreview,
  LAND_UNLOCK_ITEM_CODE,
} from '../utils'
import { TownMap } from './TownMap'
import { BuildingDetailPanel } from './BuildingDetailPanel'
import { MoveBuildingControls } from './MoveBuildingControls'

export type TownOverviewProps = {
  api: TownApi
  googleApi?: GoogleIntegrationApi
  googleIntegrationState?: GoogleIntegrationState | null
  stepSyncApi?: StepSyncApi
  rankingApi?: RankingApi
  getUserHref?: (userId: string) => string
  myTownHref?: string
  healthConnectionHref?: string
  loginHref?: string
  mode?: TownPageMode
}

type DashboardPanel = 'ranking' | 'market' | null

type PlacementSession = {
  item: BuildingCatalogItem
  anchor: Cell | null
  requestId: string
}

type MoveSession = {
  building: PlacedBuilding
  item: BuildingCatalogItem
  anchor: Cell | null
  requestId: string
}

type LandUnlockSession = {
  item: MarketItem
  area: UnlockedArea | null
  requestId: string
}

type RoadPlacementSession = {
  item: BuildingCatalogItem
  cells: Cell[]
  requestId: string
}

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `place-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ja-JP').format(value)
}

function stepSyncSuccessMessage(
  steps: number,
  newlyRewardedSteps: number,
  coinsAwarded: number,
): string {
  if (coinsAwarded > 0) {
    return `${formatNumber(steps)}歩を同期し、${formatNumber(coinsAwarded)}コイン獲得しました。`
  }
  if (newlyRewardedSteps > 0) {
    return `${formatNumber(newlyRewardedSteps)}歩を新しく同期しました。今回の獲得コインは0です。`
  }
  return '歩数は最新です。新しく付与されたコインはありません。'
}

export function TownOverview({
  api,
  googleApi,
  googleIntegrationState,
  stepSyncApi,
  rankingApi,
  getUserHref = (userId) => `/town/${encodeURIComponent(userId)}`,
  myTownHref = '/',
  healthConnectionHref = '/health/connect',
  loginHref = '/login',
  mode = { type: 'self' },
}: TownOverviewProps) {
  const state = useTownOverview(api, mode)
  const steps = useDailyStepsSummary(googleApi, googleIntegrationState)
  const stepSync = useStepSync(mode.type === 'self' ? stepSyncApi : undefined)
  const [activePanel, setActivePanel] = useState<DashboardPanel>(null)
  const [placement, setPlacement] = useState<PlacementSession | null>(null)
  const [move, setMove] = useState<MoveSession | null>(null)
  const [landUnlock, setLandUnlock] = useState<LandUnlockSession | null>(null)
  const [roadPlacement, setRoadPlacement] =
    useState<RoadPlacementSession | null>(null)
  const [isSubmittingPlacement, setIsSubmittingPlacement] = useState(false)
  const [isSubmittingMove, setIsSubmittingMove] = useState(false)
  const [isSubmittingLandUnlock, setIsSubmittingLandUnlock] = useState(false)
  const [isSubmittingRoadPlacement, setIsSubmittingRoadPlacement] =
    useState(false)
  const [placementError, setPlacementError] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [landUnlockError, setLandUnlockError] = useState<string | null>(null)
  const [roadPlacementError, setRoadPlacementError] = useState<string | null>(
    null,
  )
  const [feedback, setFeedback] = useState<string | null>(null)
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  )
  const [isRenamingBuilding, setIsRenamingBuilding] = useState(false)
  const [renameBuildingError, setRenameBuildingError] = useState<string | null>(
    null,
  )
  const [isDeletingRoad, setIsDeletingRoad] = useState(false)
  const [deleteRoadError, setDeleteRoadError] = useState<string | null>(null)
  const [deleteRoadRequestId, setDeleteRoadRequestId] = useState<string | null>(
    null,
  )

  const purchasableItemCodes = useMemo(
    () => {
      if (mode.type !== 'self' || state.data?.town.editable !== true) {
        return new Set<string>()
      }

      const codes = new Set(
        state.data.catalog
          .filter((item) => item.enabled && item.costCoins !== null)
          .map((item) => item.code),
      )
      const landUnlockItem = MARKET_ITEMS.find(
        (item) => item.code === LAND_UNLOCK_ITEM_CODE,
      )
      if (landUnlockItem && landUnlockItem.costCoins !== null) {
        codes.add(LAND_UNLOCK_ITEM_CODE)
      }
      return codes
    },
    [mode.type, state.data],
  )

  const placementPreview = useMemo(() => {
    if (!state.data || !placement?.anchor) return null

    return evaluatePlacementPreview({
      town: state.data.town,
      catalog: state.data.catalog,
      item: placement.item,
      anchor: placement.anchor,
      operation: 'place',
    })
  }, [placement, state.data])

  const movePreview = useMemo(() => {
    if (!state.data || !move?.anchor) return null

    if (
      move.anchor.x === move.building.anchorX &&
      move.anchor.y === move.building.anchorY
    ) {
      return {
        status: 'unknown' as const,
        message: '現在と同じ位置です。別の移動先を選んでください。',
      }
    }

    return evaluatePlacementPreview({
      town: state.data.town,
      catalog: state.data.catalog,
      item: move.item,
      anchor: move.anchor,
      operation: 'move',
      excludedBuildingId: move.building.id,
    })
  }, [move, state.data])

  const landUnlockPreview = useMemo(() => {
    if (!state.data || !landUnlock?.area) return null

    return evaluateLandUnlockPreview({
      town: state.data.town,
      area: landUnlock.area,
      costCoins: landUnlock.item.costCoins ?? 0,
    })
  }, [landUnlock, state.data])

  const roadLinePreview = useMemo(() => {
    if (!state.data || !roadPlacement || roadPlacement.cells.length === 0) {
      return null
    }

    return evaluateRoadLinePreview({
      town: state.data.town,
      catalog: state.data.catalog,
      item: roadPlacement.item,
      cells: roadPlacement.cells,
    })
  }, [roadPlacement, state.data])

  if (state.isLoading) {
    return (
      <section
        className="grid min-h-svh w-full place-content-center justify-items-center gap-4 px-5 text-[#71807b]"
        role="status"
        aria-label="街を読み込み中"
      >
        <span className="grid h-12 w-12 animate-pulse place-items-center rounded-[15px_15px_15px_4px] bg-[#ffcf57] font-black text-[#103b37] motion-reduce:animate-none">
          W
        </span>
        <p className="m-0 text-xs">街の景色を準備しています…</p>
      </section>
    )
  }

  if (state.error || !state.data) {
    return (
      <section
        className="grid min-h-svh w-full place-content-center justify-items-center gap-3 px-5 text-center"
        role="alert"
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#ce625b] text-xl font-black text-white">
          !
        </span>
        <h1 className="m-0 text-xl text-[#193b38]">街を読み込めませんでした</h1>
        <p className="m-0 text-xs leading-6 text-[#747e7a]">
          {state.error?.message ?? 'もう一度お試しください。'}
        </p>
        <button
          className="mt-2 min-h-11 cursor-pointer rounded-xl border-0 bg-[#123f3c] px-5 text-xs font-extrabold text-white hover:bg-[#0b322f]"
          type="button"
          onClick={state.retry}
        >
          もう一度試す
        </button>
      </section>
    )
  }

  const { town, catalog } = state.data
  const healthStatus = googleIntegrationState?.healthConnection?.status
  const dailyStepsText = stepSync.latest
    ? `${formatNumber(stepSync.latest.steps)}歩`
    : steps.isLoading
      ? '確認中…'
      : steps.dailySteps
        ? `${formatNumber(steps.dailySteps.steps)}歩`
        : healthStatus === 'permission_required'
          ? '再連携が必要'
          : steps.isConnected
            ? '取得エラー'
            : '未連携'

  const syncSteps = async () => {
    if (
      mode.type !== 'self' ||
      healthStatus !== 'connected' ||
      !stepSyncApi ||
      stepSync.isSyncing ||
      isSubmittingPlacement ||
      isSubmittingMove ||
      isSubmittingLandUnlock ||
      isSubmittingRoadPlacement
    ) {
      return
    }

    setFeedback(null)
    const result = await stepSync.sync()
    if (!result.ok) {
      if (result.error.code === 'CONFLICT') state.retry()
      return
    }

    state.applyStepSyncResult(result.data)
    setFeedback(
      stepSyncSuccessMessage(
        result.data.steps,
        result.data.newlyRewardedSteps,
        result.data.coinsAwarded,
      ),
    )
  }

  const togglePanel = (panel: Exclude<DashboardPanel, null>) => {
    setSelectedBuildingId(null)
    setRenameBuildingError(null)
    setMove(null)
    setMoveError(null)
    setActivePanel((current) => (current === panel ? null : panel))
  }

  const selectMarketItem = (marketItem: MarketItem) => {
    if (mode.type !== 'self' || !town.editable) return
    setSelectedBuildingId(null)
    setRenameBuildingError(null)
    setMove(null)
    setMoveError(null)

    if (
      marketItem.code === LAND_UNLOCK_ITEM_CODE &&
      marketItem.costCoins !== null
    ) {
      setPlacement(null)
      setRoadPlacement(null)
      setRoadPlacementError(null)
      setPlacementError(null)
      setLandUnlock({
        item: marketItem,
        area: null,
        requestId: createRequestId(),
      })
      setLandUnlockError(null)
      setFeedback(null)
      setActivePanel(null)
      return
    }

    const catalogItem = catalog.find(
      (candidate) => candidate.code === marketItem.code,
    )
    if (
      !catalogItem ||
      !catalogItem.enabled ||
      catalogItem.costCoins === null
    ) {
      return
    }

    if (catalogItem.category === 'road') {
      setRoadPlacement({
        item: catalogItem,
        cells: [],
        requestId: createRequestId(),
      })
      setPlacement(null)
      setPlacementError(null)
      setLandUnlock(null)
      setLandUnlockError(null)
      setRoadPlacementError(null)
      setFeedback(null)
      setActivePanel(null)
      return
    }

    setPlacement({
      item: catalogItem,
      anchor: null,
      requestId: createRequestId(),
    })
    setLandUnlock(null)
    setRoadPlacement(null)
    setRoadPlacementError(null)
    setLandUnlockError(null)
    setPlacementError(null)
    setFeedback(null)
    setActivePanel(null)
  }

  const selectPlacementAnchor = (anchor: Cell) => {
    setPlacement((current) => {
      if (!current) return current
      const isSameAnchor =
        current.anchor?.x === anchor.x && current.anchor?.y === anchor.y

      return {
        ...current,
        anchor,
        requestId: isSameAnchor ? current.requestId : createRequestId(),
      }
    })
    setPlacementError(null)
  }

  const cancelPlacement = () => {
    setPlacement(null)
    setPlacementError(null)
  }

  const selectLandUnlockArea = (area: UnlockedArea) => {
    setLandUnlock((current) => {
      if (!current) return current
      const isSameArea =
        current.area?.x === area.x && current.area?.y === area.y

      return {
        ...current,
        area,
        requestId: isSameArea ? current.requestId : createRequestId(),
      }
    })
    setLandUnlockError(null)
  }

  const cancelLandUnlock = () => {
    setLandUnlock(null)
    setLandUnlockError(null)
  }

  const selectRoadCells = (cells: Cell[]) => {
    setRoadPlacement((current) => {
      if (!current) return current
      const isSameLine =
        current.cells.length === cells.length &&
        current.cells.every(
          (cell, index) =>
            cell.x === cells[index].x && cell.y === cells[index].y,
        )
      return {
        ...current,
        cells,
        requestId: isSameLine ? current.requestId : createRequestId(),
      }
    })
    setRoadPlacementError(null)
  }

  const cancelRoadPlacement = () => {
    setRoadPlacement(null)
    setRoadPlacementError(null)
  }

  const confirmPlacement = async () => {
    if (
      !placement?.anchor ||
      placementPreview?.status !== 'valid' ||
      isSubmittingPlacement ||
      isSubmittingMove ||
      stepSync.isSyncing ||
      isSubmittingLandUnlock ||
      isSubmittingRoadPlacement
    ) {
      return
    }

    setIsSubmittingPlacement(true)
    setPlacementError(null)
    const result = await state.placeBuilding({
      buildingTypeCode: placement.item.code,
      anchorX: placement.anchor.x,
      anchorY: placement.anchor.y,
      requestId: placement.requestId,
    })
    setIsSubmittingPlacement(false)

    if (!result.ok) {
      setPlacementError(result.error.message)
      return
    }

    setFeedback(`${placement.item.name}を配置しました。`)
    setPlacement(null)
  }

  const confirmBuildingMove = async () => {
    if (
      !move?.anchor ||
      movePreview?.status !== 'valid' ||
      isSubmittingMove ||
      isSubmittingPlacement ||
      isSubmittingLandUnlock ||
      isSubmittingRoadPlacement ||
      stepSync.isSyncing
    ) {
      return
    }

    setIsSubmittingMove(true)
    setMoveError(null)
    const result = await state.moveBuilding({
      buildingId: move.building.id,
      anchorX: move.anchor.x,
      anchorY: move.anchor.y,
      requestId: move.requestId,
    })
    setIsSubmittingMove(false)

    if (!result.ok) {
      setMoveError(result.error.message)
      return
    }

    setFeedback(`${move.building.customName ?? move.item.name}を移動しました。`)
    setMove(null)
  }

  const confirmLandUnlock = async () => {
    if (
      !landUnlock?.area ||
      landUnlockPreview?.status !== 'valid' ||
      isSubmittingLandUnlock ||
      isSubmittingPlacement ||
      isSubmittingMove ||
      stepSync.isSyncing ||
      isSubmittingRoadPlacement
    ) {
      return
    }

    setIsSubmittingLandUnlock(true)
    setLandUnlockError(null)
    const result = await state.unlockLand({
      x: landUnlock.area.x,
      y: landUnlock.area.y,
      requestId: landUnlock.requestId,
    })
    setIsSubmittingLandUnlock(false)

    if (!result.ok) {
      setLandUnlockError(result.error.message)
      return
    }

    setFeedback('隣接する20×20区画を開放しました。')
    setLandUnlock(null)
  }

  const confirmRoadPlacement = async () => {
    if (
      !roadPlacement ||
      roadLinePreview?.status.status !== 'valid' ||
      isSubmittingRoadPlacement ||
      isSubmittingPlacement ||
      isSubmittingMove ||
      isSubmittingLandUnlock ||
      stepSync.isSyncing
    ) {
      return
    }

    setIsSubmittingRoadPlacement(true)
    setRoadPlacementError(null)
    const result = await state.placeRoadLine({
      buildingTypeCode: roadPlacement.item.code,
      cells: roadPlacement.cells,
      requestId: roadPlacement.requestId,
    })
    setIsSubmittingRoadPlacement(false)

    if (!result.ok) {
      setRoadPlacementError(result.error.message)
      return
    }

    setFeedback(
      result.data.placementKind === 'bridge'
        ? `${result.data.buildings.length}マスの橋を建設しました。`
        : `${result.data.buildings.length}マスの道路を配置しました。`,
    )
    setRoadPlacement(null)
  }

  const selectedBuilding = selectedBuildingId
    ? town.buildings.find((building) => building.id === selectedBuildingId) ??
      null
    : null
  const selectedBuildingItem = selectedBuilding
    ? catalog.find(
        (item) => item.code === selectedBuilding.buildingTypeCode,
      ) ?? null
    : null

  const selectBuilding = (buildingId: string | null) => {
    setSelectedBuildingId(buildingId)
    setRenameBuildingError(null)
    setDeleteRoadError(null)
    setDeleteRoadRequestId(buildingId ? createRequestId() : null)
    if (buildingId) setActivePanel(null)
  }

  const closeBuildingDetail = () => {
    setSelectedBuildingId(null)
    setRenameBuildingError(null)
    setDeleteRoadError(null)
    setDeleteRoadRequestId(null)
  }

  const startBuildingMove = () => {
    if (
      !selectedBuilding ||
      !selectedBuildingItem ||
      mode.type !== 'self' ||
      !town.editable ||
      isRenamingBuilding
    ) {
      return
    }

    setMove({
      building: selectedBuilding,
      item: selectedBuildingItem,
      anchor: null,
      requestId: createRequestId(),
    })
    setPlacement(null)
    setLandUnlock(null)
    setRoadPlacement(null)
    setSelectedBuildingId(null)
    setRenameBuildingError(null)
    setMoveError(null)
    setFeedback(null)
    setActivePanel(null)
  }

  const selectMoveAnchor = (anchor: Cell) => {
    setMove((current) => {
      if (!current) return current
      const isSameAnchor =
        current.anchor?.x === anchor.x && current.anchor?.y === anchor.y

      return {
        ...current,
        anchor,
        requestId: isSameAnchor ? current.requestId : createRequestId(),
      }
    })
    setMoveError(null)
  }

  const cancelBuildingMove = () => {
    setMove(null)
    setMoveError(null)
  }

  const renameSelectedBuilding = async (customName: string | null) => {
    if (
      !selectedBuilding ||
      mode.type !== 'self' ||
      !town.editable ||
      isRenamingBuilding
    ) {
      return
    }

    setIsRenamingBuilding(true)
    setRenameBuildingError(null)
    const result = await state.renameBuilding({
      buildingId: selectedBuilding.id,
      customName,
    })
    setIsRenamingBuilding(false)

    if (!result.ok) {
      setRenameBuildingError(result.error.message)
      return
    }

    setFeedback(
      result.data.building.customName
        ? '建物の表示名を変更しました。'
        : '建物の表示名を初期名に戻しました。',
    )
  }

  const deleteSelectedRoad = async () => {
    if (
      !selectedBuilding ||
      !selectedBuildingItem ||
      selectedBuildingItem.category !== 'road' ||
      !deleteRoadRequestId ||
      mode.type !== 'self' ||
      !town.editable ||
      isDeletingRoad
    ) {
      return
    }

    setIsDeletingRoad(true)
    setDeleteRoadError(null)
    const result = await state.deleteRoad({
      buildingId: selectedBuilding.id,
      requestId: deleteRoadRequestId,
    })
    setIsDeletingRoad(false)

    if (!result.ok) {
      setDeleteRoadError(result.error.message)
      return
    }

    setFeedback(
      result.data.deletionKind === 'bridge'
        ? '橋 7セルを削除しました。'
        : '道路 1セルを削除しました。',
    )
    setSelectedBuildingId(null)
    setDeleteRoadRequestId(null)
  }

  return (
    <section className="min-h-svh text-[#183b37]" aria-labelledby="town-title">
      <header className="sticky top-0 z-50 border-b border-[#cad4cc] bg-[rgba(247,246,240,.94)] shadow-[0_8px_28px_rgba(23,57,52,.08)] backdrop-blur-md">
        <nav
          className="mx-auto flex min-h-[84px] w-full max-w-[1600px] items-center gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="ユーザーダッシュボード"
        >
          <div
            className="flex min-w-[220px] shrink-0 items-center gap-3 rounded-[15px] border border-[#d7ddd6] bg-white/70 px-3 py-2 shadow-sm"
            aria-label="ユーザー情報"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px_13px_13px_4px] bg-[#ffcf57] text-base font-black text-[#103b37] shadow-[inset_0_-2px_0_rgba(0,0,0,.1)]">
              {town.town.owner.displayName.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <span className="block truncate text-[11px] font-black text-[#193b38]">
                {town.town.owner.displayName}
              </span>
              <h1
                className="m-0 mt-0.5 truncate text-[10px] font-medium text-[#7b8581]"
                id="town-title"
              >
                {town.town.name}
              </h1>
            </div>
          </div>

          {mode.type === 'public' && (
            <a
              className="inline-flex min-h-[58px] min-w-[142px] shrink-0 items-center justify-center gap-2 rounded-[15px] border border-[#b9d8ca] bg-[#dceee6] px-4 text-[11px] font-black text-[#245f51] no-underline shadow-sm transition-[background,transform] hover:-translate-y-px hover:bg-[#cfe8dc]"
              href={myTownHref}
            >
              <span aria-hidden="true">←</span>
              自分の街に戻る
            </a>
          )}

          <button
            className={`flex min-h-[58px] min-w-[126px] shrink-0 cursor-pointer items-center gap-2.5 rounded-[15px] border px-3.5 text-left transition-[background,border-color,transform] hover:-translate-y-px ${
              activePanel === 'ranking'
                ? 'border-[#6fa993] bg-[#dceee6] text-[#205b4d]'
                : 'border-[#d7ddd6] bg-white/70 text-[#315f56] hover:bg-white'
            }`}
            type="button"
            onClick={() => togglePanel('ranking')}
            aria-expanded={activePanel === 'ranking'}
            aria-controls="dashboard-side-panel"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#e7f1ec] text-sm" aria-hidden="true">
              ♛
            </span>
            <span className="text-[11px] font-black">ランキング</span>
          </button>

          {mode.type === 'self' && (
            <button
              className={`flex min-h-[58px] min-w-[126px] shrink-0 cursor-pointer items-center gap-2.5 rounded-[15px] border px-3.5 text-left transition-[background,border-color,transform] hover:-translate-y-px ${
                activePanel === 'market'
                  ? 'border-[#dfb866] bg-[#fff2cb] text-[#775b19]'
                  : 'border-[#d7ddd6] bg-white/70 text-[#315f56] hover:bg-white'
              }`}
              type="button"
              onClick={() => togglePanel('market')}
              aria-expanded={activePanel === 'market'}
              aria-controls="dashboard-side-panel"
            >
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#fff2cb] text-sm" aria-hidden="true">
                ◇
              </span>
              <span className="text-[11px] font-black">マーケット</span>
            </button>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2 max-[760px]:ml-0">
            <dl className="m-0 flex items-center gap-2">
              <div className="min-w-[120px] rounded-[15px] border border-[#d6cfe6] bg-[#f2eef9] px-4 py-2.5 shadow-sm">
                <dt className="text-[8px] font-black tracking-[.1em] text-[#766394]">
                  人口
                </dt>
                <dd className="m-0 mt-0.5 text-lg font-black tracking-[-.03em] text-[#594677]">
                  {formatNumber(town.town.population)}人
                </dd>
              </div>
              {mode.type === 'self' && (
                <>
                  <div className="min-w-[150px] rounded-[15px] border border-[#cfe0d8] bg-[#e8f3ee] px-4 py-2.5 shadow-sm">
                    <dt className="text-[8px] font-black tracking-[.1em] text-[#548274]">
                      今日の歩数
                    </dt>
                    <dd className="m-0 mt-0.5 text-lg font-black tracking-[-.03em] text-[#285b4e]">
                      {dailyStepsText}
                    </dd>
                  </div>
                  <div className="min-w-[130px] rounded-[15px] border border-[#e3d5a2] bg-[#fff9dc] px-4 py-2.5 shadow-sm">
                    <dt className="text-[8px] font-black tracking-[.1em] text-[#9a7d29]">
                      所持コイン数
                    </dt>
                    <dd className="m-0 mt-0.5 text-lg font-black tracking-[-.03em] text-[#6f581c]">
                      {town.town.coins === undefined
                        ? '非公開'
                        : formatNumber(town.town.coins)}
                    </dd>
                  </div>
                </>
              )}
            </dl>

            {mode.type === 'self' &&
              (healthStatus === 'connected' ? (
                <button
                  className="min-h-[58px] min-w-[112px] cursor-pointer rounded-[15px] border border-[#b9d8ca] bg-[#dceee6] px-3 text-[10px] font-black text-[#245f51] shadow-sm hover:bg-[#cfe8dc] disabled:cursor-not-allowed disabled:border-[#d7ddd6] disabled:bg-[#edf1ed] disabled:text-[#7f8985]"
                  type="button"
                  onClick={() => void syncSteps()}
                  disabled={
                    !stepSyncApi ||
                    stepSync.isSyncing ||
                    isSubmittingPlacement ||
                    isSubmittingMove ||
                    isSubmittingLandUnlock ||
                    isSubmittingRoadPlacement
                  }
                  aria-describedby={stepSync.error ? 'step-sync-error' : undefined}
                  title={
                    stepSync.latest
                      ? `最終同期: ${stepSync.latest.syncedAt}`
                      : undefined
                  }
                >
                  {stepSync.isSyncing ? '同期中…' : '歩数を同期 ↻'}
                </button>
              ) : (
                <a
                  className="inline-flex min-h-[58px] min-w-[112px] items-center justify-center rounded-[15px] border border-[#b9d8ca] bg-[#dceee6] px-3 text-center text-[10px] font-black text-[#245f51] no-underline shadow-sm hover:bg-[#cfe8dc]"
                  href={healthConnectionHref}
                >
                  {healthStatus === 'permission_required'
                    ? '歩数を再連携'
                    : 'Healthを連携'}
                </a>
              ))}
          </div>
        </nav>
        {mode.type === 'self' && stepSync.error && (
          <div
            className="mx-auto mb-2 flex w-[calc(100%-24px)] max-w-[1576px] items-center justify-between gap-3 rounded-xl border border-[#e7bbb3] bg-[#f9e6e1] px-3 py-2 text-[10px] font-bold text-[#8b473e]"
            id="step-sync-error"
            role="alert"
          >
            <span>{stepSync.error.message}</span>
            {stepSync.error.code === 'UNAUTHENTICATED' ? (
              <a className="shrink-0 font-black text-[#71352f]" href={loginHref}>
                再ログイン
              </a>
            ) : stepSync.error.code === 'HEALTH_NOT_CONNECTED' ||
              stepSync.error.code === 'HEALTH_PERMISSION_REQUIRED' ? (
              <a
                className="shrink-0 font-black text-[#71352f]"
                href={healthConnectionHref}
              >
                再連携
              </a>
            ) : (
              <button
                className="shrink-0 cursor-pointer border-0 bg-transparent p-1 text-[10px] font-black text-[#71352f] underline"
                type="button"
                onClick={() => void syncSteps()}
                disabled={stepSync.isSyncing}
              >
                再試行
              </button>
            )}
          </div>
        )}
      </header>

      <main className="relative mx-auto w-full max-w-[1600px] p-3">
        <TownMap
          key={town.town.id}
          town={town}
          catalog={catalog}
          viewportClassName="h-[calc(100svh-132px)] min-h-[430px] max-h-none"
          placement={
            placement
              ? {
                  item: placement.item,
                  operation: 'place',
                  anchor: placement.anchor,
                  preview: placementPreview,
                  onSelectAnchor: selectPlacementAnchor,
                }
              : move
                ? {
                    item: move.item,
                    operation: 'move',
                    displayName: move.building.customName ?? move.item.name,
                    anchor: move.anchor,
                    preview: movePreview,
                    onSelectAnchor: selectMoveAnchor,
                  }
              : null
          }
          landUnlock={
            landUnlock
              ? {
                  area: landUnlock.area,
                  preview: landUnlockPreview,
                  onSelectArea: selectLandUnlockArea,
                }
              : null
          }
          roadPlacement={
            roadPlacement
              ? {
                  item: roadPlacement.item,
                  cells: roadPlacement.cells,
                  preview: roadLinePreview,
                  onSelectCells: selectRoadCells,
                }
              : null
          }
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={selectBuilding}
        />

        <div className="pointer-events-none absolute bottom-7 left-7 z-30 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-white/70 bg-[rgba(247,246,240,.86)] px-3 py-2 text-[8px] text-[#66726e] shadow-sm backdrop-blur-sm max-[560px]:right-7 max-[560px]:justify-center">
          <span className="inline-flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-[3px] border border-[#8ab07f] bg-[#cbe1ba]" />
            開放済み
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-[3px] border border-[#aab0a9] bg-[#c8cec5]" />
            未開放
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-[3px] bg-[#87908c]" />
            道路
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-[3px] border border-[#b66b52] bg-[#f3c9aa]" />
            建物
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-[3px] border border-[#5798aa] bg-[#73c5e3]" />
            川
          </span>
        </div>
      </main>

      {feedback && (
        <div
          className="fixed top-[100px] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#b9d8ca] bg-[#e4f3eb] px-4 py-2.5 text-[10px] font-black text-[#28624f] shadow-lg"
          role="status"
        >
          <span aria-hidden="true">✓</span>
          {feedback}
          <button
            className="grid h-6 w-6 cursor-pointer place-items-center rounded-full border-0 bg-white/70 text-xs text-[#52635e]"
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="通知を閉じる"
          >
            ×
          </button>
        </div>
      )}

      {activePanel && (mode.type === 'self' || activePanel === 'ranking') && (
        <aside
          className="fixed top-[96px] right-3 bottom-3 z-40 w-[min(520px,calc(100vw-24px))] overflow-y-auto rounded-[22px] border border-[#d3dbd5] bg-[rgba(247,246,240,.97)] shadow-[-18px_20px_55px_rgba(18,55,49,.2)] backdrop-blur-md max-[700px]:top-auto max-[700px]:left-3 max-[700px]:h-[min(68svh,620px)] max-[700px]:w-auto"
          id="dashboard-side-panel"
          aria-label={activePanel === 'ranking' ? 'ランキングパネル' : 'マーケットパネル'}
        >
          <button
            className="sticky top-3 z-10 ml-auto mr-3 grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[#d7ddd6] bg-white text-base font-black text-[#52635e] shadow-sm hover:bg-[#edf3ef]"
            type="button"
            onClick={() => setActivePanel(null)}
            aria-label="パネルを閉じる"
          >
            ×
          </button>

          {activePanel === 'ranking' && rankingApi ? (
            <div className="-mt-10 pt-10">
              <PopulationRanking
                api={rankingApi}
                getUserHref={getUserHref}
                variant="panel"
              />
            </div>
          ) : activePanel === 'ranking' ? (
            <PanelUnavailable title="ランキングを読み込めません" />
          ) : (
            <MarketList
              items={MARKET_ITEMS}
              purchasableItemCodes={purchasableItemCodes}
              selectedItemCode={
                placement?.item.code ??
                landUnlock?.item.code ??
                roadPlacement?.item.code
              }
              onSelectItem={selectMarketItem}
            />
          )}
        </aside>
      )}

      {selectedBuilding && selectedBuildingItem && (
        <BuildingDetailPanel
          key={`${selectedBuilding.id}:${selectedBuilding.updatedAt}`}
          building={selectedBuilding}
          item={selectedBuildingItem}
          editable={mode.type === 'self' && town.editable}
          canRename={api.supportsBuildingRename !== false}
          isSaving={isRenamingBuilding}
          isDeleting={isDeletingRoad}
          errorMessage={
            selectedBuildingItem.category === 'road'
              ? deleteRoadError
              : renameBuildingError
          }
          onClose={closeBuildingDetail}
          onRename={(customName) => void renameSelectedBuilding(customName)}
          onDeleteRoad={() => void deleteSelectedRoad()}
          onMove={
            selectedBuildingItem.category === 'road'
              ? undefined
              : startBuildingMove
          }
        />
      )}

      {placement && (
        <PlacementControls
          item={placement.item}
          anchor={placement.anchor}
          preview={placementPreview}
          isSubmitting={isSubmittingPlacement}
          isConfirmBlocked={
            stepSync.isSyncing ||
            isSubmittingMove ||
            isSubmittingLandUnlock ||
            isSubmittingRoadPlacement
          }
          errorMessage={placementError}
          onCancel={cancelPlacement}
          onConfirm={confirmPlacement}
        />
      )}

      {move && (
        <MoveBuildingControls
          item={move.item}
          displayName={move.building.customName ?? move.item.name}
          anchor={move.anchor}
          preview={movePreview}
          isSubmitting={isSubmittingMove}
          isConfirmBlocked={
            stepSync.isSyncing ||
            isSubmittingPlacement ||
            isSubmittingLandUnlock ||
            isSubmittingRoadPlacement
          }
          errorMessage={moveError}
          onCancel={cancelBuildingMove}
          onConfirm={() => void confirmBuildingMove()}
        />
      )}

      {roadPlacement && (
        <RoadPlacementControls
          item={roadPlacement.item}
          preview={roadLinePreview}
          isSubmitting={isSubmittingRoadPlacement}
          isConfirmBlocked={
            stepSync.isSyncing ||
            isSubmittingPlacement ||
            isSubmittingMove ||
            isSubmittingLandUnlock
          }
          errorMessage={roadPlacementError}
          onCancel={cancelRoadPlacement}
          onConfirm={confirmRoadPlacement}
        />
      )}

      {landUnlock && (
        <LandUnlockControls
          item={landUnlock.item}
          area={landUnlock.area}
          preview={landUnlockPreview}
          isSubmitting={isSubmittingLandUnlock}
          isConfirmBlocked={
            stepSync.isSyncing ||
            isSubmittingPlacement ||
            isSubmittingMove ||
            isSubmittingRoadPlacement
          }
          errorMessage={landUnlockError}
          onCancel={cancelLandUnlock}
          onConfirm={confirmLandUnlock}
        />
      )}
    </section>
  )
}

function PanelUnavailable({ title }: { title: string }) {
  return (
    <section className="grid min-h-[380px] place-content-center justify-items-center gap-3 px-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#ce625b] text-xl font-black text-white">
        !
      </span>
      <h2 className="m-0 text-lg text-[#193b38]">{title}</h2>
    </section>
  )
}
