import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { paths } from '../paths'

export function GameLayout() {
  const location = useLocation()
  const isTownDashboard = location.pathname === paths.root

  if (isTownDashboard) {
    return (
      <div className="min-h-svh bg-[#e9ede7]">
        <main>
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[linear-gradient(rgba(8,44,42,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(8,44,42,.025)_1px,transparent_1px),#f7f6f0] bg-[size:32px_32px]">
      <header className="sticky top-0 z-20 border-b border-[rgba(18,63,60,.1)] bg-[rgba(247,246,240,.9)] backdrop-blur-md">
        <div className="mx-auto flex min-h-[68px] w-full max-w-[1080px] items-center gap-5 px-5 max-[520px]:px-3.5 max-[360px]:gap-1.5">
          <Link
            className="flex items-center gap-2.5 font-black tracking-[-.02em] text-[#123f3c] no-underline"
            to={paths.root}
          >
            <span className="grid h-9 w-9 place-items-center rounded-[11px_11px_11px_3px] bg-[#ffcf57] text-lg font-black text-[#0b2d2b] shadow-[inset_0_-2px_0_rgba(0,0,0,.12)]">
              W
            </span>
            <span className="max-[420px]:sr-only">Walk City</span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 max-[360px]:gap-0" aria-label="メインナビゲーション">
            <NavLink
              className={({ isActive }) =>
                `rounded-[10px] px-3.5 py-2 text-xs font-extrabold no-underline transition-colors max-[360px]:px-2 max-[360px]:text-[10px] ${
                  isActive
                    ? 'bg-[#dceee6] text-[#205b4d]'
                    : 'text-[#68736f] hover:bg-white hover:text-[#214d45]'
                }`
              }
              to={paths.root}
            >
              <span className="max-[360px]:hidden">マイタウン</span>
              <span className="hidden max-[360px]:inline">街</span>
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `rounded-[10px] px-3.5 py-2 text-xs font-extrabold no-underline transition-colors max-[360px]:px-2 max-[360px]:text-[10px] ${
                  isActive
                    ? 'bg-[#dceee6] text-[#205b4d]'
                    : 'text-[#68736f] hover:bg-white hover:text-[#214d45]'
                }`
              }
              to={paths.ranking}
            >
              <span className="max-[360px]:hidden">ランキング</span>
              <span className="hidden max-[360px]:inline">順位</span>
            </NavLink>
            <Link
              className="rounded-[10px] px-3.5 py-2 text-xs font-extrabold text-[#68736f] no-underline hover:bg-white hover:text-[#214d45] max-[360px]:px-2 max-[360px]:text-[10px]"
              to={paths.login}
            >
              <span className="max-[360px]:hidden">連携設定</span>
              <span className="hidden max-[360px]:inline">設定</span>
            </Link>
          </nav>
          <span className="hidden items-center gap-1.5 rounded-full border border-[#d8d9d0] bg-white/70 px-2.5 py-1.5 text-[9px] font-black tracking-[.08em] text-[#66706d] sm:inline-flex">
            <i className="h-1.5 w-1.5 rounded-full bg-[#42ae80] shadow-[0_0_0_3px_rgba(66,174,128,.12)]" />
            MOCK API
          </span>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
