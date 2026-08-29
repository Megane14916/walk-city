const SKELETON_ROWS = 6

export function RankingListSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-[21px] border border-[#dfe3dc] bg-[rgba(255,255,255,.72)]"
      role="status"
      aria-label="人口ランキングを読み込み中"
    >
      <span className="sr-only">
        ランキングを読み込んでいます…
      </span>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div
          className="grid min-h-[82px] grid-cols-[60px_minmax(160px,1fr)_110px] items-center gap-4 border-t border-[#e9ebe6] px-7 py-3.5 first:border-t-0"
          aria-hidden="true"
          key={index}
        >
          <span className="h-[42px] w-[42px] animate-pulse rounded-[14px] bg-[#e8ebe6] motion-reduce:animate-none" />
          <span className="h-[17px] animate-pulse rounded-full bg-[#e8ebe6] motion-reduce:animate-none" />
          <span className="h-[17px] w-[90px] animate-pulse justify-self-end rounded-full bg-[#e8ebe6] motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  )
}
