import { useMemo, useState } from 'react'
import type { GoogleIntegrationApi } from '../../auth/api'
import type { GoogleIntegrationState } from '../../auth/types'
import {
  MARKET_ITEMS,
  MarketList,
  PlacementControls,
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
import type { BuildingCatalogItem, Cell } from '../types'
import { evaluatePlacementPreview } from '../utils'
import { TownMap } from './TownMap'

export type TownOverviewProps = {
  api: TownApi
  googleApi?: GoogleIntegrationApi
  googleIntegrationState?: GoogleIntegrationState | null
  rankingApi?: RankingApi
  getUserHref?: (userId: string) => string
  mode?: TownPageMode
}

type DashboardPanel = 'ranking' | 'market' | null

type PlacementSession = {
  item: BuildingCatalogItem
  anchor: Cell | null
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

export function TownOverview({
  api,
  googleApi,
  googleIntegrationState,
  rankingApi,
  getUserHref = (userId) => `/users/${encodeURIComponent(userId)}`,
  mode = { type: 'self' },
}: TownOverviewProps) {
  const state = useTownOverview(api, mode)
  const steps = useDailyStepsSummary(googleApi, googleIntegrationState)
  const [activePanel, setActivePanel] = useState<DashboardPanel>(null)
  const [placement, setPlacement] = useState<PlacementSession | null>(null)
  const [isSubmittingPlacement, setIsSubmittingPlacement] = useState(false)
  const [placementError, setPlacementError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const purchasableItemCodes = useMemo(
    () => {
      if (mode.type !== 'self' || state.data?.town.editable !== true) {
        return new Set<string>()
      }

      return new Set(
        state.data.catalog
          .filter((item) => item.enabled && item.costCoins !== null)
          .map((item) => item.code),
      )
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
  const dailyStepsText = steps.isLoading
    ? '確認中…'
    : steps.dailySteps
      ? `${formatNumber(steps.dailySteps.steps)}歩`
      : steps.isConnected
        ? '取得エラー'
        : '未連携'

  const togglePanel = (panel: Exclude<DashboardPanel, null>) => {
    setActivePanel((current) => (current === panel ? null : panel))
  }

  const selectMarketItem = (marketItem: MarketItem) => {
    if (mode.type !== 'self' || !town.editable) return

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

    setPlacement({
      item: catalogItem,
      anchor: null,
      requestId: createRequestId(),
    })
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

  const confirmPlacement = async () => {
    if (
      !placement?.anchor ||
      placementPreview?.status !== 'valid' ||
      isSubmittingPlacement
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

          {mode.type === 'self' && (
            <div className="ml-auto flex shrink-0 items-center gap-2 max-[760px]:ml-0">
              <dl className="m-0 flex items-center gap-2">
              <div className="min-w-[150px] rounded-[15px] border border-[#cfe0d8] bg-[#e8f3ee] px-4 py-2.5 shadow-sm">
                <dt className="text-[8px] font-black tracking-[.1em] text-[#548274]">今日の歩数</dt>
                <dd className="m-0 mt-0.5 text-lg font-black tracking-[-.03em] text-[#285b4e]">
                  {dailyStepsText}
                </dd>
              </div>
              <div className="min-w-[130px] rounded-[15px] border border-[#e3d5a2] bg-[#fff9dc] px-4 py-2.5 shadow-sm">
                <dt className="text-[8px] font-black tracking-[.1em] text-[#9a7d29]">所持コイン数</dt>
                <dd className="m-0 mt-0.5 text-lg font-black tracking-[-.03em] text-[#6f581c]">
                  {town.town.coins === undefined
                    ? '非公開'
                    : formatNumber(town.town.coins)}
                </dd>
              </div>
              </dl>
            </div>
          )}
        </nav>
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
                  anchor: placement.anchor,
                  preview: placementPreview,
                  onSelectAnchor: selectPlacementAnchor,
                }
              : null
          }
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

      {activePanel && (
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
              selectedItemCode={placement?.item.code}
              onSelectItem={selectMarketItem}
            />
          )}
        </aside>
      )}

      {placement && (
        <PlacementControls
          item={placement.item}
          anchor={placement.anchor}
          preview={placementPreview}
          isSubmitting={isSubmittingPlacement}
          errorMessage={placementError}
          onCancel={cancelPlacement}
          onConfirm={confirmPlacement}
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
