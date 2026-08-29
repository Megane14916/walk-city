import type {
  BuildingCatalogItem,
  RoadLineInvalidReason,
  RoadLinePreview,
} from '../../town/types'

export type RoadPlacementControlsProps = {
  item: BuildingCatalogItem
  preview: RoadLinePreview | null
  isSubmitting: boolean
  isConfirmBlocked?: boolean
  errorMessage: string | null
  onCancel: () => void
  onConfirm: () => void
}

const invalidReasonMessages: Record<RoadLineInvalidReason, string> = {
  OUT_OF_MAP: 'マップ内を水平または垂直にドラッグしてください。',
  LAND_LOCKED: '開放済みの土地だけを通る線にしてください。',
  CELL_OCCUPIED: '道路以外の建物や障害物を避けてください。',
  CATALOG_ITEM_DISABLED: '道路は現在購入できません。',
  PRICE_NOT_SET: '道路の価格は準備中です。',
  INSUFFICIENT_COINS: '購入に必要なコインが不足しています。',
  ROAD_REQUIRED: '道路の配置条件を確認してください。',
  RIVER_BLOCKED: '川を通らない位置を選んでください。',
  BRIDGE_SPAN_REQUIRED: '両岸を含む7マスを一度に選んでください。',
  BRIDGE_DIRECTION_INVALID: '川を直角に横断してください。',
  BRIDGE_CORNER_FORBIDDEN: '川の曲がり角を避けてください。',
  NO_NEW_ROAD_CELLS: '選択した場所にはすでに道路があります。',
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ja-JP').format(value)
}

function previewMessage(preview: RoadLinePreview | null): string {
  if (!preview) return 'マップ上をドラッグして道路の線を引いてください。'
  if (preview.status.status === 'unknown') return preview.status.message
  if (preview.status.status === 'invalid') {
    return invalidReasonMessages[preview.status.reason]
  }

  if (preview.placementKind === 'bridge') {
    return `橋5マスと両岸の進入道路2マスを建設できます。合計${formatNumber(preview.totalCostCoins)}コインです。`
  }

  const existingCount = preview.cells.length - preview.newCells.length
  return existingCount > 0
    ? `${preview.newCells.length}マスを新しく配置します。既存道路${existingCount}マスには接続します。`
    : `${preview.newCells.length}マスの道路をまとめて配置できます。`
}

export function RoadPlacementControls({
  item,
  preview,
  isSubmitting,
  isConfirmBlocked = false,
  errorMessage,
  onCancel,
  onConfirm,
}: RoadPlacementControlsProps) {
  const isValid = preview?.status.status === 'valid'
  const totalCost = preview?.totalCostCoins ?? 0
  const isBridge = preview?.placementKind === 'bridge'
  const statusTone = !preview
    ? 'bg-[#edf1ed] text-[#66726e]'
    : isValid
      ? 'bg-[#e1f1e9] text-[#28624f]'
      : 'bg-[#f8e4de] text-[#985044]'
  const confirmLabel =
    isBridge && isValid
      ? `${formatNumber(totalCost)}コインで橋を建設`
      : isBridge
        ? '橋を建設'
      : totalCost === 0
        ? `${preview?.newCells.length ?? 0}マスを無料で配置`
        : `${formatNumber(totalCost)}コインでまとめて配置`

  return (
    <section
      className="fixed right-1/2 bottom-5 z-40 w-[min(620px,calc(100vw-32px))] translate-x-1/2 rounded-[20px] border border-white/80 bg-[rgba(247,246,240,.96)] p-3 shadow-[0_18px_48px_rgba(18,55,49,.25)] backdrop-blur-md max-[560px]:bottom-3"
      aria-labelledby="road-placement-title"
    >
      <div className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#e5e9e6] text-xl font-black text-[#52615c]"
          aria-hidden="true"
        >
          {isBridge ? '═' : '━'}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-[8px] font-black tracking-[.14em] text-[#66726e]">
            {isBridge ? '橋建設モード' : '道路作成モード'}
          </span>
          <h2
            className="m-0 truncate text-[15px] tracking-[-.02em] text-[#193b38]"
            id="road-placement-title"
          >
            {isBridge ? '橋を配置' : `${item.name}を線で配置`}
          </h2>
        </div>
        {preview && (
          <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[9px] font-black tabular-nums text-[#52615c] shadow-sm">
            {preview.cells.length}マス
          </span>
        )}
      </div>

      <div
        className={`mt-2 rounded-xl px-3 py-2 text-[10px] font-bold leading-5 ${statusTone}`}
        role="status"
        aria-live="polite"
      >
        {errorMessage ?? previewMessage(preview)}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          className="min-h-11 flex-1 cursor-pointer rounded-xl border border-[#d2d9d3] bg-white px-4 text-[11px] font-black text-[#52615c] hover:bg-[#edf1ed] disabled:cursor-not-allowed"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          キャンセル
        </button>
        <button
          className="min-h-11 flex-[1.7] cursor-pointer rounded-xl border-0 bg-[#123f3c] px-4 text-[11px] font-black text-white shadow-sm hover:bg-[#0b322f] disabled:cursor-not-allowed disabled:bg-[#aeb8b3]"
          type="button"
          onClick={onConfirm}
          disabled={!isValid || isSubmitting || isConfirmBlocked}
        >
          {isSubmitting
            ? isBridge
              ? '橋を建設中…'
              : '道路を配置中…'
            : confirmLabel}
        </button>
      </div>
    </section>
  )
}
