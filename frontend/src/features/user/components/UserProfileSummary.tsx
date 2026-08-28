import { Link } from 'react-router-dom'
import type { PublicUserProfile } from '../types'

const populationFormatter = new Intl.NumberFormat('ja-JP')

export type UserProfileSummaryProps = {
  profile: PublicUserProfile
  rankingHref: string
  townHref: string
}

function getInitial(displayName: string): string {
  return Array.from(displayName.trim())[0] ?? 'W'
}

export function UserProfileSummary({
  profile,
  rankingHref,
  townHref,
}: UserProfileSummaryProps) {
  return (
    <section
      className="mx-auto w-full max-w-[760px] px-[clamp(18px,5vw,46px)] pt-[clamp(28px,6vw,64px)] pb-14 text-[#183b37] max-[420px]:px-3.5"
      aria-labelledby="user-profile-title"
    >
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-xs font-extrabold text-[#357762] no-underline transition-colors hover:bg-white/80 hover:text-[#194c42] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgba(40,124,100,.32)]"
        to={rankingHref}
      >
        <span aria-hidden="true">←</span>
        ランキングへ戻る
      </Link>

      <div className="mt-5 overflow-hidden rounded-[28px] border border-[#dce1da] bg-[rgba(255,255,255,.82)] shadow-[0_22px_55px_rgba(35,70,61,.09)] motion-safe:animate-onboarding-enter motion-reduce:animate-none">
        <div className="h-28 bg-[radial-gradient(circle_at_18%_20%,rgba(255,207,87,.9)_0_8%,transparent_9%),linear-gradient(135deg,#dcefe7,#eff5e9_58%,#fff0bd)] max-[480px]:h-24" />

        <div className="px-[clamp(20px,5vw,44px)] pb-[clamp(24px,5vw,42px)]">
          <span
            className="-mt-12 grid h-24 w-24 place-items-center rounded-[30px_30px_30px_9px] border-[6px] border-white bg-[#174c47] text-[34px] font-black text-[#ffdc72] shadow-[0_12px_28px_rgba(18,63,60,.2)] max-[480px]:-mt-10 max-[480px]:h-20 max-[480px]:w-20 max-[480px]:rounded-[25px_25px_25px_8px] max-[480px]:text-3xl"
            aria-hidden="true"
          >
            {getInitial(profile.displayName)}
          </span>

          <span className="mt-5 block text-[10px] font-black tracking-[.18em] text-[#438c76]">
            PUBLIC PROFILE
          </span>
          <h1
            className="mt-2 mb-0 [overflow-wrap:anywhere] text-[clamp(30px,6vw,48px)] leading-[1.12] tracking-[-.05em] text-[#102f2d]"
            id="user-profile-title"
          >
            {profile.displayName}
          </h1>
          <p className="mt-3 mb-0 text-sm leading-7 text-[#6d7773]">
            このユーザーが育てている街を見てみましょう。
          </p>

          <div className="mt-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 rounded-[20px] border border-[#dfe5dc] bg-[#f7faf5] px-[clamp(17px,4vw,28px)] py-5 max-[480px]:grid-cols-1 max-[480px]:gap-4">
            <div className="min-w-0">
              <span className="text-[9px] font-black tracking-[.14em] text-[#6c9a89]">
                TOWN
              </span>
              <h2 className="mt-1.5 mb-0 [overflow-wrap:anywhere] text-xl leading-[1.35] tracking-[-.025em] text-[#193b38]">
                {profile.town.name}
              </h2>
            </div>
            <div className="min-w-[132px] border-l border-[#d9e1d9] pl-6 text-right max-[480px]:min-w-0 max-[480px]:border-t max-[480px]:border-l-0 max-[480px]:pt-4 max-[480px]:pl-0 max-[480px]:text-left">
              <span className="block text-[9px] font-black tracking-[.12em] text-[#779087]">
                POPULATION
              </span>
              <p className="mt-1 mb-0 whitespace-nowrap tabular-nums">
                <strong className="text-[clamp(24px,5vw,34px)] tracking-[-.04em] text-[#153a36]">
                  {populationFormatter.format(profile.town.population)}
                </strong>
                <small className="ml-1.5 text-[10px] font-extrabold text-[#78847f]">
                  人
                </small>
              </p>
            </div>
          </div>

          <Link
            className="mt-6 flex min-h-[54px] w-full items-center justify-center gap-3 rounded-[15px] bg-[#123f3c] px-5 text-sm font-extrabold text-white no-underline shadow-[0_12px_28px_rgba(9,54,51,.18)] transition-[transform,box-shadow,background] duration-200 hover:-translate-y-0.5 hover:bg-[#0b322f] hover:shadow-[0_16px_34px_rgba(9,54,51,.23)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)]"
            to={townHref}
          >
            このユーザーの街を訪問
            <span className="text-lg" aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
