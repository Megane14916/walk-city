import { Link } from 'react-router-dom'
import { paths } from '../paths'

export function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-content-center justify-items-center gap-3 bg-[#f7f6f0] px-5 text-center">
      <span className="text-6xl font-black tracking-[-.06em] text-[#ffcf57]">
        404
      </span>
      <h1 className="m-0 text-2xl text-[#193b38]">ページが見つかりません</h1>
      <p className="m-0 text-xs text-[#747e7a]">
        URLを確認するか、自分の街へ戻ってください。
      </p>
      <Link
        className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-[#123f3c] px-5 text-xs font-extrabold text-white no-underline"
        to={paths.root}
      >
        自分の街へ
      </Link>
    </main>
  )
}
