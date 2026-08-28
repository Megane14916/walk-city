import { useMemo, useState, type FormEvent } from 'react'
import type { BuildingCatalogItem, PlacedBuilding } from '../types'

export type BuildingDetailPanelProps = {
  building: PlacedBuilding
  item: BuildingCatalogItem
  editable: boolean
  isSaving: boolean
  errorMessage: string | null
  onClose: () => void
  onRename: (customName: string | null) => void
}

const categoryLabels: Record<string, string> = {
  residential: '住宅',
  road: '道路',
  public: '公共施設',
  commercial: '商業施設',
  nature: '自然・農業',
  industry: '産業施設',
  special: '特別施設',
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ja-JP').format(value)
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)
  })
}

function validateName(value: string): string | null {
  const normalized = value.trim()
  if (normalized.length === 0) return '表示名を入力してください。'
  if (Array.from(normalized).length > 30) {
    return '表示名は30文字以内で入力してください。'
  }
  if (hasControlCharacter(normalized)) {
    return '表示名に改行や制御文字は使用できません。'
  }
  return null
}

export function BuildingDetailPanel({
  building,
  item,
  editable,
  isSaving,
  errorMessage,
  onClose,
  onRename,
}: BuildingDetailPanelProps) {
  const displayName = building.customName ?? item.name
  const [nameInput, setNameInput] = useState(displayName)
  const [validationError, setValidationError] = useState<string | null>(null)
  const populationEffect = useMemo(
    () =>
      item.effects.reduce((total, effect) => {
        if (effect.type !== 'population_flat' || effect.value === null) {
          return total
        }
        return total + effect.value
      }, 0),
    [item.effects],
  )

  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationMessage = validateName(nameInput)
    setValidationError(validationMessage)
    if (validationMessage) return
    const normalized = nameInput.trim()
    onRename(normalized === item.name ? null : normalized)
  }

  const resetName = () => {
    setNameInput(item.name)
    setValidationError(null)
    onRename(null)
  }

  return (
    <aside
      className="fixed top-[96px] right-3 bottom-3 z-40 w-[min(420px,calc(100vw-24px))] overflow-y-auto rounded-[22px] border border-[#d3dbd5] bg-[rgba(247,246,240,.97)] p-4 shadow-[-18px_20px_55px_rgba(18,55,49,.2)] backdrop-blur-md max-[700px]:top-auto max-[700px]:left-3 max-[700px]:h-[min(72svh,620px)] max-[700px]:w-auto"
      aria-labelledby="building-detail-title"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-[#fff2cb] text-xl font-black text-[#82651d]"
          aria-hidden="true"
        >
          {item.category === 'road' ? '━' : '⌂'}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-[8px] font-black tracking-[.14em] text-[#78827e]">
            {categoryLabels[item.category] ?? item.category}
          </span>
          <h2
            className="m-0 mt-0.5 break-words text-lg tracking-[-.02em] text-[#193b38]"
            id="building-detail-title"
          >
            {displayName}
          </h2>
          {building.customName && (
            <p className="m-0 mt-1 text-[9px] text-[#7b8581]">
              建物の種類: {item.name}
            </p>
          )}
        </div>
        <button
          className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-[#d7ddd6] bg-white text-base font-black text-[#52635e] hover:bg-[#edf3ef]"
          type="button"
          onClick={onClose}
          aria-label="建物詳細を閉じる"
        >
          ×
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-xl border border-[#d7ddd6] bg-white/75 p-3">
          <dt className="font-black text-[#78827e]">大きさ</dt>
          <dd className="m-0 mt-1 text-sm font-black text-[#315f56]">
            {item.width}×{item.height}
          </dd>
        </div>
        <div className="rounded-xl border border-[#d7ddd6] bg-white/75 p-3">
          <dt className="font-black text-[#78827e]">座標</dt>
          <dd className="m-0 mt-1 text-sm font-black text-[#315f56]">
            ({building.anchorX}, {building.anchorY})
          </dd>
        </div>
        <div className="rounded-xl border border-[#e3d5a2] bg-[#fff9dc] p-3">
          <dt className="font-black text-[#9a7d29]">現在の価格</dt>
          <dd className="m-0 mt-1 text-sm font-black text-[#6f581c]">
            {item.costCoins === null
              ? '準備中'
              : `${formatNumber(item.costCoins)}コイン`}
          </dd>
        </div>
        <div className="rounded-xl border border-[#d6cfe6] bg-[#f2eef9] p-3">
          <dt className="font-black text-[#766394]">人口への効果</dt>
          <dd className="m-0 mt-1 text-sm font-black text-[#594677]">
            {populationEffect > 0
              ? `+${formatNumber(populationEffect)}人`
              : 'なし'}
          </dd>
        </div>
      </dl>

      <section className="mt-3 rounded-2xl border border-[#d7ddd6] bg-white/75 p-3">
        <h3 className="m-0 text-[11px] text-[#193b38]">効果・説明</h3>
        {item.effects.length > 0 ? (
          <ul className="m-0 mt-2 grid list-none gap-2 p-0">
            {item.effects.map((effect, index) => (
              <li
                key={`${effect.type}:${index}`}
                className="rounded-xl bg-[#edf3ef] px-3 py-2 text-[10px] font-bold leading-5 text-[#45635b]"
              >
                {effect.description}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-2 text-[10px] leading-5 text-[#66726e]">
            {item.description || '現在設定されている効果はありません。'}
          </p>
        )}
      </section>

      {editable && (
        <form
          className="mt-3 rounded-2xl border border-[#cfe0d8] bg-[#e8f3ee] p-3"
          onSubmit={submitName}
        >
          <label
            className="block text-[10px] font-black text-[#315f56]"
            htmlFor="building-display-name"
          >
            建物の表示名
          </label>
          <input
            className="mt-2 h-11 w-full rounded-xl border border-[#b9d0c5] bg-white px-3 text-sm text-[#193b38] outline-none focus:border-[#4b8b74] focus:ring-2 focus:ring-[#86b9a5]/40 disabled:bg-[#edf1ed]"
            id="building-display-name"
            value={nameInput}
            onChange={(event) => {
              setNameInput(event.target.value)
              setValidationError(null)
            }}
            disabled={isSaving}
            aria-describedby={
              validationError || errorMessage ? 'building-name-error' : undefined
            }
          />
          <div className="mt-1 flex items-center justify-between gap-2 text-[8px] text-[#71807b]">
            <span>1〜30文字</span>
            <span>{Array.from(nameInput.trim()).length}/30</span>
          </div>
          {(validationError || errorMessage) && (
            <p
              className="m-0 mt-2 rounded-lg bg-[#f8e4de] px-2 py-1.5 text-[9px] font-bold text-[#985044]"
              id="building-name-error"
              role="alert"
            >
              {validationError ?? errorMessage}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              className="min-h-10 flex-1 cursor-pointer rounded-xl border border-[#b9d0c5] bg-white px-3 text-[10px] font-black text-[#52615c] hover:bg-[#edf1ed] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={resetName}
              disabled={isSaving || building.customName === null}
            >
              初期名に戻す
            </button>
            <button
              className="min-h-10 flex-[1.3] cursor-pointer rounded-xl border-0 bg-[#123f3c] px-3 text-[10px] font-black text-white hover:bg-[#0b322f] disabled:cursor-not-allowed disabled:bg-[#aeb8b3]"
              type="submit"
              disabled={
                isSaving || nameInput.trim() === displayName
              }
            >
              {isSaving ? '保存中…' : '表示名を保存'}
            </button>
          </div>
        </form>
      )}
    </aside>
  )
}
