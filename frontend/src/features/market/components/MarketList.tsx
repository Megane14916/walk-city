import type { MarketItem } from '../types'

export type MarketListProps = {
  items: MarketItem[]
  purchasableItemCodes?: ReadonlySet<string>
  selectedItemCode?: string | null
  onSelectItem?: (item: MarketItem) => void
}

const categoryStyles: Record<MarketItem['category'], string> = {
  residential: 'border-[#d99b70] bg-[#f7d8bd] text-[#7d4328]',
  nature: 'border-[#89ae78] bg-[#dcebcf] text-[#3f6c3a]',
  public: 'border-[#78a6a0] bg-[#d5e9e6] text-[#35655f]',
  commercial: 'border-[#d7b25d] bg-[#fff0b8] text-[#765a18]',
  industry: 'border-[#9a9e9a] bg-[#e3e5e2] text-[#515956]',
  road: 'border-[#7f8884] bg-[#cbd0cd] text-[#3f4945]',
  expansion: 'border-[#9882ad] bg-[#e9dff1] text-[#624b76]',
}

const categoryMarks: Record<MarketItem['category'], string> = {
  residential: '⌂',
  nature: '♧',
  public: '＋',
  commercial: '◇',
  industry: '▥',
  road: '＝',
  expansion: '↗',
}

function formatCost(costCoins: number | null): string {
  return costCoins === null
    ? ''
    : new Intl.NumberFormat('ja-JP').format(costCoins)
}

export function MarketList({
  items,
  purchasableItemCodes,
  selectedItemCode = null,
  onSelectItem,
}: MarketListProps) {
  return (
    <section className="px-5 pb-7 max-[520px]:px-3" aria-labelledby="market-title">
      <div className="-mt-7 mb-5 pr-12">
        <span className="text-[9px] font-black tracking-[.18em] text-[#a4822e]">
          MARKET
        </span>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h2
              className="m-0 text-[26px] tracking-[-.04em] text-[#193b38]"
              id="market-title"
            >
              マーケット
            </h2>
            <p className="mt-1.5 mb-0 text-[11px] leading-5 text-[#77817d]">
              街に追加できるアイテムの一覧です
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#fff2cb] px-2.5 py-1 text-[9px] font-black text-[#82651d]">
            {items.length} ITEMS
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-[17px] border border-[#d7ddd6] bg-white/75 shadow-sm">
        <div
          className="grid grid-cols-[minmax(136px,1.3fr)_minmax(156px,1.55fr)_54px_50px] gap-2 border-b border-[#d7ddd6] bg-[#edf1ed] px-3 py-2.5 text-[8px] font-black tracking-[.08em] text-[#697570] max-[420px]:hidden"
          aria-hidden="true"
        >
          <span>建物の種類</span>
          <span>機能</span>
          <span>コスト</span>
          <span>大きさ</span>
        </div>

        <ul className="m-0 list-none p-0" aria-label="マーケットアイテム">
          {items.map((item) => {
            const canPurchase =
              item.costCoins !== null &&
              purchasableItemCodes?.has(item.code) === true &&
              onSelectItem !== undefined
            const isSelected = selectedItemCode === item.code

            return (
              <li
                className="border-b border-[#e3e7e2] last:border-b-0"
                key={item.code}
              >
                <button
                  className={`grid min-h-[68px] w-full grid-cols-[minmax(136px,1.3fr)_minmax(156px,1.55fr)_54px_50px] items-center gap-2 border-0 px-3 py-2.5 text-left font-[inherit] transition-colors max-[420px]:grid-cols-[minmax(0,1fr)_auto_auto] max-[420px]:items-start max-[420px]:gap-x-2.5 max-[420px]:gap-y-2 max-[420px]:py-3 ${
                    isSelected
                      ? 'bg-[#fff5d6]'
                      : canPurchase
                        ? 'cursor-pointer bg-transparent hover:bg-[#fff9e8]'
                        : 'cursor-default bg-transparent'
                  }`}
                  type="button"
                  aria-label={
                    canPurchase
                      ? `${item.name}を選択`
                      : `${item.name}は準備中`
                  }
                  aria-disabled={!canPurchase}
                  aria-pressed={canPurchase ? isSelected : undefined}
                  tabIndex={canPurchase ? 0 : -1}
                  onClick={() => {
                    if (canPurchase) onSelectItem(item)
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2.5 max-[420px]:col-span-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border text-base font-black ${categoryStyles[item.category]}`}
                      aria-hidden="true"
                    >
                      {categoryMarks[item.category]}
                    </span>
                    <span className="text-[11px] font-black leading-[1.45] text-[#27423d]">
                      {item.name}
                    </span>
                    {canPurchase && (
                      <span className="rounded-full bg-[#fff0b8] px-1.5 py-0.5 text-[7px] font-black tracking-[.04em] text-[#765a18]">
                        選ぶ
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] leading-[1.55] text-[#000000] text-font-weight-[700px] max-[420px]:self-center">
                    {item.effect}
                  </span>
                  <span
                    className={`text-[11px] font-black tabular-nums text-[#765a18] ${
                      item.costCoins === null
                        ? ''
                        : 'max-[420px]:rounded-md max-[420px]:bg-[#fff7dd] max-[420px]:px-1.5 max-[420px]:py-1'
                    }`}
                  >
                    {formatCost(item.costCoins)}
                  </span>
                  <span className="text-[10px] font-extrabold tabular-nums text-[#52615c] max-[420px]:rounded-md max-[420px]:bg-[#edf1ed] max-[420px]:px-1.5 max-[420px]:py-1">
                    {item.width}×{item.height}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
