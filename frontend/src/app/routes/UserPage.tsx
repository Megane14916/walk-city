import { Link, useParams } from 'react-router-dom'
import { paths } from '../paths'

export function UserPage() {
  const { userId } = useParams<{ userId: string }>()

  if (!userId || userId.trim() === '') {
    return (
      <section className="mx-auto grid min-h-[calc(100svh-68px)] max-w-2xl place-content-center justify-items-center gap-3 px-5 text-center">
        <h1 className="m-0 text-2xl text-[#193b38]">
          ユーザーを特定できませんでした
        </h1>
        <Link className="text-sm font-extrabold text-[#357762]" to={paths.ranking}>
          ランキングへ戻る
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto grid min-h-[calc(100svh-68px)] max-w-2xl place-content-center justify-items-center gap-4 px-5 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-[20px_20px_20px_7px] bg-[#dceee6] text-2xl font-black text-[#245f51]">
        W
      </span>
      <span className="text-[10px] font-black tracking-[.16em] text-[#438c76]">
        USER PROFILE
      </span>
      <h1 className="m-0 text-[clamp(28px,5vw,42px)] tracking-[-.04em] text-[#193b38]">
        ユーザーページは準備中です
      </h1>
      <p className="m-0 max-w-lg text-sm leading-7 text-[#747e7a]">
        このユーザーの公開情報と街への入口は、ユーザー・Map機能の実装時に追加されます。
      </p>
      <code className="rounded-lg bg-white/70 px-3 py-2 text-[10px] text-[#7f8985]">
        {userId}
      </code>
      <Link
        className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-[#123f3c] px-5 text-xs font-extrabold text-white no-underline hover:bg-[#0b322f]"
        to={paths.ranking}
      >
        ← ランキングへ戻る
      </Link>
    </section>
  )
}
