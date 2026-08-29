import type { ApiError } from '../../../types/common'

export type RankingLoadMoreProps = {
  hasNextPage: boolean
  isLoading: boolean
  error: ApiError | null
  onLoadMore: () => void
  onRetry: () => void
}

export function RankingLoadMore({
  hasNextPage,
  isLoading,
  error,
  onLoadMore,
  onRetry,
}: RankingLoadMoreProps) {
  if (error) {
    return (
      <div
        className="flex flex-col items-center gap-[9px] px-0 pt-6 pb-1.5"
        role="alert"
      >
        <p className="m-0 text-[11px] text-[#963f3b]">{error.message}</p>
        <button
          className="cursor-pointer border-0 bg-transparent text-[11px] font-black text-[#8b3d39] underline"
          type="button"
          onClick={onRetry}
        >
          追加取得を再試行
        </button>
      </div>
    )
  }

  if (!hasNextPage) {
    return (
      <p
        className="mt-[22px] mb-[5px] flex items-center justify-center gap-[7px] text-[10px] text-[#7d8783]"
        role="status"
      >
        <span
          className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#67a78e] text-[9px] text-white"
          aria-hidden="true"
        >
          ✓
        </span>
        すべてのランキングを表示しました
      </p>
    )
  }

  return (
    <div className="flex justify-center px-0 pt-6 pb-1.5">
      <button
        className="inline-flex min-h-[45px] items-center justify-center gap-2.5 rounded-[13px] border-0 bg-[#123f3c] px-[23px] text-xs font-extrabold text-white shadow-[0_9px_22px_rgba(9,54,51,.15)] hover:bg-[#0b322f] disabled:cursor-wait disabled:opacity-60 max-[620px]:w-full max-[620px]:max-w-80"
        type="button"
        onClick={onLoadMore}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span
              className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none"
              aria-hidden="true"
            />
            読み込み中…
          </>
        ) : (
          <>
            さらに見る
            <span aria-hidden="true">↓</span>
          </>
        )}
      </button>
    </div>
  )
}
