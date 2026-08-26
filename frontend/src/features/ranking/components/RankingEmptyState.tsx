export type RankingEmptyStateProps = {
  onRefresh: () => void
  isRefreshing: boolean
}

export function RankingEmptyState({
  onRefresh,
  isRefreshing,
}: RankingEmptyStateProps) {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center rounded-[21px] border border-[#dfe3dc] bg-[rgba(255,255,255,.72)] px-5 py-[42px] text-center">
      <span className="flex h-[72px] items-end gap-[5px]" aria-hidden="true">
        <span className="grid h-[70px] w-9 place-items-center rounded-[9px_9px_3px_3px] bg-[#ffdf7c] text-[11px] font-black text-[#194b43]">
          1
        </span>
        <span className="grid h-[52px] w-9 place-items-center rounded-[9px_9px_3px_3px] bg-[#dcefe7] text-[11px] font-black text-[#194b43]">
          2
        </span>
        <span className="grid h-[38px] w-9 place-items-center rounded-[9px_9px_3px_3px] bg-[#efd3bd] text-[11px] font-black text-[#194b43]">
          3
        </span>
      </span>
      <h3 className="mt-[18px] mb-0 text-lg text-[#1a3e3a]">
        まだランキング参加者がいません
      </h3>
      <p className="mt-[9px] mb-5 max-w-[420px] text-xs leading-[1.7] text-[#747e7a]">
        街の人口が登録されると、ここにランキングが表示されます。
      </p>
      <button
        className="inline-flex min-h-[45px] items-center justify-center gap-2.5 rounded-[13px] border-0 bg-[#123f3c] px-[23px] text-xs font-extrabold text-white shadow-[0_9px_22px_rgba(9,54,51,.15)] hover:bg-[#0b322f] disabled:cursor-wait disabled:opacity-60"
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? '更新中…' : 'もう一度確認する'}
      </button>
    </div>
  )
}
