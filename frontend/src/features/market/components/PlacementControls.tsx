import type {
  BuildingCatalogItem,
  Cell,
  PlacementPreviewStatus,
  PreviewInvalidReason,
} from '../../town/types'

export type PlacementControlsProps = {
  item: BuildingCatalogItem
  anchor: Cell | null
  preview: PlacementPreviewStatus | null
  isSubmitting: boolean
  isConfirmBlocked?: boolean
  errorMessage: string | null
  onCancel: () => void
  onConfirm: () => void
}

const invalidReasonMessages: Record<PreviewInvalidReason, string> = {
  OUT_OF_MAP: 'マップ内の位置を選んでください。',
  LAND_LOCKED: '開放済みの土地を選んでください。',
  CELL_OCCUPIED: 'ほかの建物や障害物と重ならない位置を選んでください。',
  CATALOG_ITEM_DISABLED: 'このアイテムは現在購入できません。',
  PRICE_NOT_SET: 'このアイテムは価格の準備中です。',
  INSUFFICIENT_COINS: '購入に必要なコインが不足しています。',
  ROAD_REQUIRED: '道路に隣接する位置を選んでください。',
  RIVER_BLOCKED: '川の上には配置できません。',
}

function previewMessage(
  anchor: Cell | null,
  preview: PlacementPreviewStatus | null,
): string {
  if (!anchor || !preview) return 'マップ上の配置したいセルを選んでください。'
  if (preview.status === 'valid') return 'この位置に配置できます。'
  if (preview.status === 'unknown') return preview.message
  return invalidReasonMessages[preview.reason]
}

function formatCost(costCoins: number): string {
  return new Intl.NumberFormat('ja-JP').format(costCoins)
}

export function PlacementControls({
  item,
  anchor,
  preview,
  isSubmitting,
  isConfirmBlocked = false,
  errorMessage,
  onCancel,
  onConfirm,
}: PlacementControlsProps) {
  const isValid = preview?.status === 'valid'
  const statusTone = !anchor
    ? 'bg-[#edf1ed] text-[#66726e]'
    : isValid
      ? 'bg-[#e1f1e9] text-[#28624f]'
      : 'bg-[#f8e4de] text-[#985044]'
  const confirmLabel =
    item.costCoins === 0
      ? '無料で購入・配置'
      : `${formatCost(item.costCoins ?? 0)}コインで購入・配置`

  return (
    <section
      className="fixed right-1/2 bottom-5 z-40 w-[min(620px,calc(100vw-32px))] translate-x-1/2 rounded-[20px] border border-white/80 bg-[rgba(247,246,240,.96)] p-3 shadow-[0_18px_48px_rgba(18,55,49,.25)] backdrop-blur-md max-[560px]:bottom-3"
      aria-labelledby="placement-title"
    >
      <div className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#fff2cb] text-xl font-black text-[#82651d]"
          aria-hidden="true"
        >
          ◇
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-[8px] font-black tracking-[.14em] text-[#9a7d29]">
            配置モード
          </span>
          <h2
            className="m-0 truncate text-[15px] tracking-[-.02em] text-[#193b38]"
            id="placement-title"
          >
            {item.name}を配置
          </h2>
        </div>
        <span className="shrink-0 rounded-lg bg-[#edf1ed] px-2 py-1 text-[9px] font-black tabular-nums text-[#52615c]">
          {item.width}×{item.height}
        </span>
        {anchor && (
          <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[9px] font-black tabular-nums text-[#52615c] shadow-sm">
            ({anchor.x}, {anchor.y})
          </span>
        )}
      </div>

      <div
        className={`mt-2 rounded-xl px-3 py-2 text-[10px] font-bold leading-5 ${statusTone}`}
        role="status"
        aria-live="polite"
      >
        {errorMessage ?? previewMessage(anchor, preview)}
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
          {isSubmitting ? '購入・配置中…' : confirmLabel}
        </button>
      </div>
    </section>
  )
}
