import type { RankingEntry } from '../types'
import { RankingItem } from './RankingItem'

export type RankingListProps = {
  entries: RankingEntry[]
  getUserHref: (userId: string) => string
}

export function RankingList({ entries, getUserHref }: RankingListProps) {
  return (
    <div className="overflow-hidden rounded-[21px] border border-[#dfe3dc] bg-[rgba(255,255,255,.82)] shadow-[0_18px_45px_rgba(24,59,55,.07)]">
      <div
        className="grid grid-cols-[78px_minmax(0,1fr)_150px] border-b border-[#e5e8e2] bg-[#f3f3ed] py-[11px] pr-[58px] pl-6 text-[9px] font-black tracking-[.12em] text-[#87908c] max-[620px]:hidden"
        aria-hidden="true"
      >
        <span>順位</span>
        <span>ユーザーと街</span>
        <span className="text-right">人口</span>
      </div>
      <ol
        className="m-0 list-none divide-y divide-[#e8eae5] p-0"
        aria-label="人口ランキング"
      >
        {entries.map((entry) => (
          <RankingItem
            key={entry.userId}
            entry={entry}
            href={getUserHref(entry.userId)}
          />
        ))}
      </ol>
    </div>
  )
}
