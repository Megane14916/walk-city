import { Outlet } from 'react-router-dom'

export function GameLayout() {
  return (
    <div className="min-h-svh bg-[#e9ede7]">
      <main>
        <Outlet />
      </main>
    </div>
  )
}
