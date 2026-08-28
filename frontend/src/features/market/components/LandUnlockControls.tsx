import type {
  LandUnlockInvalidReason,
  LandUnlockPreviewStatus,
  UnlockedArea,
} from '../../town/types'
import type { MarketItem } from '../types'

export type LandUnlockControlsProps = {
  item: MarketItem
  area: UnlockedArea | null
  preview: LandUnlockPreviewStatus | null
  isSubmitting: boolean
  isConfirmBlocked?: boolean
  errorMessage: string | null
  onCancel: () => void
  onConfirm: () => void
}

const invalidReasonMessages: Record<LandUnlockInvalidReason, string> = {
  OUT_OF_MAP: 'マップ内の20×20区画を選んでください。',
  AREA_ALREADY_UNLOCKED: 'この区画はすでに開放されています。',
  AREA_NOT_ADJACENT: '開放済み区画の真上・真下・真左・真右を選んでください。',
  INSUFFICIENT_COINS: '開放に必要なコインが不足しています。',
}

function formatCost(costCoins: number): string {
  return new Intl.NumberFormat('ja-JP').format(costCoins)
}

function previewMessage(
  area: UnlockedArea | null,
  preview: LandUnlockPreviewStatus | null,
): string {
  if (!area || !preview) {
    return '開放済み区画の上下左右にある20×20区画を選んでください。'
  }
  if (preview.status === 'valid') return 'この20×20区画を開放できます。'
  return invalidReasonMessages[preview.reason]
}

export function LandUnlockControls({
  item,
  area,
  preview,
  isSubmitting,
  isConfirmBlocked = false,
  errorMessage,
  onCancel,
  onConfirm,
}: LandUnlockControlsProps) {
  const isValid = preview?.status === 'valid'
  const statusTone = !area
    ? 'bg-[#edf1ed] text-[#66726e]'
    : isValid
      ? 'bg-[#e1f1e9] text-[#28624f]'
      : 'bg-[#f8e4de] text-[#985044]'
  const confirmLabel =
    item.costCoins === 0
      ? '無料で開放'
      : `${formatCost(item.costCoins ?? 0)}コインで開放`

  return (
    <section
      className="fixed right-1/2 bottom-5 z-40 w-[min(620px,calc(100vw-32px))] translate-x-1/2 rounded-[20px] border border-white/80 bg-[rgba(247,246,240,.96)] p-3 shadow-[0_18px_48px_rgba(18,55,49,.25)] backdrop-blur-md max-[560px]:bottom-3"
      aria-labelledby="land-unlock-title"
    >
      <div className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#e9dff1] text-xl font-black text-[#624b76]"
          aria-hidden="true"
        >
          ↗
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-[8px] font-black tracking-[.14em] text-[#745c8b]">
            土地開放モード
          </span>
          <h2
            className="m-0 truncate text-[15px] tracking-[-.02em] text-[#193b38]"
            id="land-unlock-title"
          >
            {item.name}
          </h2>
        </div>
        <span className="shrink-0 rounded-lg bg-[#edf1ed] px-2 py-1 text-[9px] font-black tabular-nums text-[#52615c]">
          {item.width}×{item.height}
        </span>
        {area && (
          <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[9px] font-black tabular-nums text-[#52615c] shadow-sm">
            ({area.x}, {area.y})
          </span>
        )}
      </div>

      <div
        className={`mt-2 rounded-xl px-3 py-2 text-[10px] font-bold leading-5 ${statusTone}`}
        role="status"
        aria-live="polite"
      >
        {errorMessage ?? previewMessage(area, preview)}
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
          {isSubmitting ? '土地を開放中…' : confirmLabel}
        </button>
      </div>
    </section>
  )
}
