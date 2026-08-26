import type { RankingEntry } from '../types'

const populationFormatter = new Intl.NumberFormat('ja-JP')

export type RankingItemProps = {
  entry: RankingEntry
  href: string
}

const topRankClasses: Partial<Record<number, string>> = {
  1: 'h-[43px] w-[43px] justify-center justify-self-center rounded-[14px_14px_14px_5px] bg-gradient-to-br from-[#ffe89b] to-[#ffca45] text-[#684b05] shadow-[0_6px_14px_rgba(197,143,12,.18)] max-[620px]:h-[38px] max-[620px]:w-[38px]',
  2: 'h-[43px] w-[43px] justify-center justify-self-center rounded-[14px_14px_14px_5px] bg-gradient-to-br from-[#edf1f2] to-[#cbd5d9] text-[#526067] max-[620px]:h-[38px] max-[620px]:w-[38px]',
  3: 'h-[43px] w-[43px] justify-center justify-self-center rounded-[14px_14px_14px_5px] bg-gradient-to-br from-[#f2c298] to-[#d89359] text-[#70451f] max-[620px]:h-[38px] max-[620px]:w-[38px]',
}

const avatarClasses = [
  'bg-[#d9eee5] text-[#174a42]',
  'bg-[#fff0bd] text-[#745a15]',
  'bg-[#f6dfdc] text-[#744a46]',
]

function getInitial(displayName: string): string {
  return Array.from(displayName.trim())[0] ?? 'W'
}

export function RankingItem({ entry, href }: RankingItemProps) {
  const rankClass =
    topRankClasses[entry.rank] ?? 'justify-center text-[#50605b]'
  const avatarClass = avatarClasses[entry.rank % avatarClasses.length]

  return (
    <li>
      <a
        className={`group grid min-h-[82px] grid-cols-[60px_44px_minmax(0,1fr)_132px_22px] items-center gap-3.5 px-5 py-3 pl-[18px] text-inherit no-underline transition-[background,transform] duration-200 hover:bg-[#f6faf7] focus-visible:relative focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[rgba(40,124,100,.32)] max-[620px]:min-h-[77px] max-[620px]:grid-cols-[42px_38px_minmax(0,1fr)_auto] max-[620px]:gap-[9px] max-[620px]:px-3 max-[620px]:py-2.5 max-[620px]:pl-[9px] ${
          entry.isCurrentUser
            ? 'bg-gradient-to-r from-[#eaf5ef] to-[#f7faf5] shadow-[inset_4px_0_#479477] hover:from-[#e1f1e9] hover:to-[#f3f8f2]'
            : ''
        }`}
        href={href}
        aria-current={entry.isCurrentUser ? 'true' : undefined}
        aria-label={`${entry.rank}位、${entry.displayName}、${entry.townName}、人口${populationFormatter.format(entry.population)}人${entry.isCurrentUser ? '、あなた' : ''}`}
      >
        <span
          className={`flex items-baseline tabular-nums ${rankClass}`}
          aria-hidden="true"
        >
          <span className="text-[22px] font-black tracking-[-.05em] max-[620px]:text-lg">
            {entry.rank}
          </span>
          <small className="ml-0.5 text-[9px] font-extrabold">位</small>
        </span>

        <span
          className={`grid h-[42px] w-[42px] place-items-center rounded-full text-sm font-black max-[620px]:h-9 max-[620px]:w-9 max-[620px]:text-xs ${avatarClass}`}
          aria-hidden="true"
        >
          {getInitial(entry.displayName)}
        </span>

        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <strong
              className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#193b38] max-[620px]:text-xs"
              title={entry.displayName}
            >
              {entry.displayName}
            </strong>
            {entry.isCurrentUser && (
              <span className="shrink-0 rounded-full bg-[#438c76] px-[7px] py-[3px] text-[8px] font-black text-white">
                あなた
              </span>
            )}
          </span>
          <span
            className="mt-1.5 flex items-center gap-[5px] overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-[#858e8a]"
            title={entry.townName}
          >
            <span className="text-xs text-[#6baa92]" aria-hidden="true">
              ⌂
            </span>
            {entry.townName}
          </span>
        </span>

        <span className="whitespace-nowrap text-right tabular-nums">
          <strong className="text-[19px] tracking-[-.03em] text-[#153a36] max-[620px]:text-[15px]">
            {populationFormatter.format(entry.population)}
          </strong>
          <small className="ml-1 text-[9px] font-extrabold text-[#7f8985]">
            人
          </small>
        </span>

        <span
          className="text-base text-[#9aa29f] transition-[color,transform] duration-200 group-hover:translate-x-[3px] group-hover:text-[#438c76] max-[620px]:hidden"
          aria-hidden="true"
        >
          →
        </span>
      </a>
    </li>
  )
}
