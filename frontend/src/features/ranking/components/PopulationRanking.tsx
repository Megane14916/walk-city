import type { RankingApi } from '../api'
import { usePopulationRanking } from '../hooks'
import { RankingEmptyState } from './RankingEmptyState'
import { RankingList } from './RankingList'
import { RankingListSkeleton } from './RankingListSkeleton'
import { RankingLoadMore } from './RankingLoadMore'

export type PopulationRankingProps = {
  api: RankingApi
  getUserHref: (userId: string) => string
}

export function PopulationRanking({
  api,
  getUserHref,
}: PopulationRankingProps) {
  const ranking = usePopulationRanking(api)

  return (
    <section
      className="mx-auto w-full max-w-[980px] px-[clamp(18px,4vw,42px)] pt-[clamp(28px,5vw,64px)] pb-12 text-[#183b37] max-[620px]:px-3.5"
      aria-labelledby="ranking-title"
    >
      <header className="mb-[26px] flex items-end justify-between gap-6 max-[620px]:items-start">
        <div>
          <span className="mb-[9px] block text-[11px] font-black tracking-[.18em] text-[#438c76]">
            CITY LEADERBOARD
          </span>
          <h1
            className="m-0 text-[clamp(32px,5vw,48px)] leading-[1.1] tracking-[-.05em] text-[#102f2d]"
            id="ranking-title"
          >
            人口ランキング
          </h1>
          <p className="mt-3 mb-0 text-sm text-[#6d7773] max-[620px]:max-w-[230px] max-[620px]:text-xs max-[620px]:leading-[1.6]">
            みんなの街の成長を見て、新しい街を訪れてみよう。
          </p>
        </div>
        <button
          className="inline-flex min-h-[43px] min-w-[104px] items-center justify-center gap-2 rounded-xl border border-[#d6dbd4] bg-[rgba(255,255,255,.74)] px-4 text-xs font-extrabold text-[#315f56] transition-[background,border-color,transform] duration-200 hover:-translate-y-px hover:border-[#98b9ac] hover:bg-white disabled:cursor-wait disabled:opacity-60 max-[620px]:min-w-[82px] max-[620px]:px-3"
          type="button"
          onClick={() => void ranking.refresh()}
          disabled={ranking.isInitialLoading || ranking.isRefreshing}
        >
          <span aria-hidden="true">↻</span>
          {ranking.isRefreshing ? '更新中…' : '更新'}
        </button>
      </header>

      <div className="sr-only" aria-live="polite">
        {ranking.isRefreshing && 'ランキングを更新しています。'}
        {!ranking.isRefreshing &&
          ranking.refreshError &&
          `更新できませんでした。${ranking.refreshError.message}`}
      </div>

      {ranking.refreshError && (
        <div
          className="mb-[15px] grid grid-cols-[auto_1fr_auto] items-center gap-[11px] rounded-xl border border-[#efcbc6] bg-[#fff0ed] px-3.5 py-[11px] text-[#8d3e3a] max-[620px]:grid-cols-[auto_1fr]"
          role="alert"
        >
          <span
            className="grid h-[23px] w-[23px] place-items-center rounded-full bg-[#c75b54] text-[11px] font-black text-white"
            aria-hidden="true"
          >
            !
          </span>
          <p className="m-0">
            <strong className="block text-[11px]">
              ランキングを更新できませんでした
            </strong>
            <small className="mt-0.5 block text-[9px] text-[#a4605c]">
              {ranking.refreshError.message}
            </small>
          </p>
          <button
            className="cursor-pointer border-0 bg-transparent text-[11px] font-black text-[#8b3d39] underline max-[620px]:col-start-2 max-[620px]:justify-self-start max-[620px]:p-0"
            type="button"
            onClick={() => void ranking.refresh()}
          >
            再試行
          </button>
        </div>
      )}

      {ranking.isInitialLoading ? (
        <RankingListSkeleton />
      ) : ranking.initialError ? (
        <div
          className="flex min-h-[380px] flex-col items-center justify-center rounded-[21px] border border-[#dfe3dc] bg-[rgba(255,255,255,.72)] px-5 py-[42px] text-center"
          role="alert"
        >
          <span
            className="grid h-12 w-12 place-items-center rounded-full bg-[#ce625b] text-[22px] font-black text-white"
            aria-hidden="true"
          >
            !
          </span>
          <h2 className="mt-[18px] mb-0 text-lg text-[#1a3e3a]">
            ランキングを読み込めませんでした
          </h2>
          <p className="mt-[9px] mb-5 max-w-[420px] text-xs leading-[1.7] text-[#747e7a]">
            {ranking.initialError.message}
          </p>
          <button
            className="inline-flex min-h-[45px] items-center justify-center gap-2.5 rounded-[13px] border-0 bg-[#123f3c] px-[23px] text-xs font-extrabold text-white shadow-[0_9px_22px_rgba(9,54,51,.15)] hover:bg-[#0b322f]"
            type="button"
            onClick={() => void ranking.retryInitial()}
          >
            もう一度試す
          </button>
        </div>
      ) : ranking.entries.length === 0 ? (
        <RankingEmptyState
          onRefresh={() => void ranking.refresh()}
          isRefreshing={ranking.isRefreshing}
        />
      ) : (
        <>
          <RankingList
            entries={ranking.entries}
            getUserHref={getUserHref}
          />
          <RankingLoadMore
            hasNextPage={ranking.hasNextPage}
            isLoading={ranking.isLoadingMore}
            error={ranking.loadMoreError}
            onLoadMore={() => void ranking.loadMore()}
            onRetry={() => void ranking.retryLoadMore()}
          />
        </>
      )}

      <p className="mt-5 mb-0 text-center text-[9px] text-[#969d99]">
        人口と順位は街の最新データをもとに集計されます。
      </p>
    </section>
  )
}
