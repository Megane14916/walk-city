import type { ReactNode } from 'react'
import '../../App.css'

export type OnboardingLayoutProps = {
  children: ReactNode
}

function BrandScene() {
  return (
    <div className="city-scene" aria-hidden="true">
      <div className="sun" />
      <div className="cloud cloud-one" />
      <div className="cloud cloud-two" />
      <div className="building building-one">
        <span /><span /><span /><span />
      </div>
      <div className="building building-two">
        <span /><span /><span /><span /><span /><span />
      </div>
      <div className="building building-three">
        <span /><span />
      </div>
      <div className="tree tree-one"><span /></div>
      <div className="tree tree-two"><span /></div>
      <div className="road">
        <i /><i /><i /><i />
      </div>
      <div className="walker"><span /></div>
    </div>
  )
}

export function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <main className="app-shell">
      <aside className="brand-panel">
        <div className="brand-lockup">
          <span className="brand-icon">W</span>
          <span>Walk City</span>
        </div>

        <div className="brand-copy">
          <span className="brand-kicker">WALK. BUILD. GROW.</span>
          <h2>歩いた分だけ、<br />あなたの街が育っていく。</h2>
          <p>毎日の一歩をコインに変えて、あなただけの街をつくろう。</p>
        </div>

        <BrandScene />

        <div className="brand-proof">
          <span className="proof-avatars"><i>Y</i><i>M</i><i>K</i></span>
          <p><b>1,240人</b>が今週、街づくりを始めました</p>
        </div>
      </aside>

      <section className="auth-panel">
        <header className="auth-header">
          <div className="mobile-brand">
            <span className="brand-icon">W</span>
            <b>Walk City</b>
          </div>
        </header>

        <div className="auth-content">{children}</div>

        <footer className="auth-footer">
          <span>© 2026 Walk City</span>
          <nav aria-label="フッターリンク">
            <a href="#privacy">プライバシー</a>
            <a href="#help">ヘルプ</a>
          </nav>
        </footer>
      </section>
    </main>
  )
}
