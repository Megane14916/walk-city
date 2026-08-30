import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../paths'

export type OnboardingLayoutProps = {
  children: ReactNode
}

function BrandScene() {
  const cloudClass =
    "absolute h-2 rounded-[20px] bg-white/20 after:absolute after:top-[-12px] after:left-[15px] after:h-2 after:w-6 after:rounded-[20px] after:bg-[inherit] after:content-['']"
  const buildingClass =
    'absolute bottom-[46px] grid content-start gap-[9px] px-[13px] py-4 shadow-[0_18px_40px_rgba(0,0,0,.25)] max-[560px]:origin-bottom max-[560px]:scale-[.72] [&>span]:h-2.5 [&>span]:w-2.5 [&>span]:rounded-sm [&>span]:bg-[#ffcf57] [&>span]:opacity-80'
  const treeClass =
    "absolute bottom-[46px] h-[58px] w-[42px] rounded-[50%_50%_42%_42%] bg-[#65b98c] after:absolute after:bottom-[-25px] after:left-[18px] after:h-[34px] after:w-1.5 after:bg-[#755d3f] after:content-['']"

  return (
    <div
      className="relative z-[1] mt-auto mr-[-28px] ml-[-28px] h-[clamp(220px,30vh,330px)] border-b border-white/10 max-[900px]:absolute max-[900px]:right-[1%] max-[900px]:bottom-0 max-[900px]:m-0 max-[900px]:h-[220px] max-[900px]:w-[42%] max-[900px]:min-w-[260px] max-[900px]:opacity-[.82] max-[560px]:right-[-12%] max-[560px]:h-[180px] max-[560px]:w-[53%]"
      aria-hidden="true"
    >
      <div className="absolute top-[22px] right-[12%] h-[62px] w-[62px] rounded-full bg-[#ffcf57] shadow-[0_0_0_13px_rgba(255,207,87,.08)] max-[560px]:h-[43px] max-[560px]:w-[43px]" />
      <div className={`${cloudClass} top-[45px] left-[15%] w-[62px]`} />
      <div className={`${cloudClass} top-[102px] right-[31%] w-[46px] opacity-55`} />
      <div className={`${buildingClass} left-[8%] h-28 w-[62px] grid-cols-2 bg-[#2f7f72]`}>
        <span /><span /><span /><span />
      </div>
      <div className={`${buildingClass} left-[35%] h-[168px] w-[85px] grid-cols-2 border-t-[11px] border-[#71d1b1] bg-[#184f4d]`}>
        <span /><span /><span /><span /><span /><span />
      </div>
      <div className={`${buildingClass} right-[12%] h-[89px] w-[68px] grid-cols-2 bg-[#3d6b61]`}>
        <span /><span />
      </div>
      <div className={`${treeClass} left-[25%] scale-[.8]`}><span /></div>
      <div className={`${treeClass} right-[31%] scale-[.65]`}><span /></div>
      <div className="absolute inset-x-0 bottom-0 h-[47px] -skew-x-16 border-t border-white/10 bg-[rgba(1,17,19,.75)] [&>i]:relative [&>i]:mx-[5%] [&>i]:my-[22px] [&>i]:inline-block [&>i]:h-[3px] [&>i]:w-[9%] [&>i]:bg-white/25">
        <i /><i /><i /><i />
      </div>
      <div className="absolute bottom-7 left-[66%] z-[3] h-8 w-5 rounded-[10px_10px_4px_4px] bg-[#ff6f61] shadow-[0_5px_16px_rgba(0,0,0,.35)] before:absolute before:top-[-11px] before:left-[3px] before:h-[13px] before:w-[13px] before:rounded-full before:bg-[#f1c5a9] before:content-[''] after:absolute after:top-[31px] after:left-2 after:h-[18px] after:w-[3px] after:rotate-[18deg] after:bg-[#ffcf57] after:shadow-[8px_-1px_0_#ffcf57] after:content-['']"><span /></div>
    </div>
  )
}

export function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <main className="grid min-h-svh grid-cols-[minmax(360px,43%)_minmax(520px,57%)] bg-[#f7f6f0] max-[900px]:grid-cols-1">
      <aside className="relative flex min-h-svh flex-col overflow-hidden bg-[radial-gradient(circle_at_72%_17%,rgba(107,207,177,.18),transparent_27%),linear-gradient(145deg,#113835_0%,#0a2929_54%,#071f22_100%)] px-[clamp(34px,5vw,76px)] pt-11 pb-8 text-[#f7f7ea] before:absolute before:top-[30%] before:left-[-240px] before:h-[420px] before:w-[420px] before:rounded-full before:border before:border-white/10 before:shadow-[0_0_0_70px_rgba(255,255,255,.018),0_0_0_140px_rgba(255,255,255,.012)] before:content-[''] max-[900px]:min-h-[260px] max-[900px]:p-7 max-[560px]:min-h-[210px]">
        <div className="relative z-[2] flex items-center gap-3 text-[21px] font-extrabold tracking-[-.02em] max-[900px]:hidden">
          <span className="inline-grid h-9 w-9 place-items-center rounded-[11px_11px_11px_3px] bg-[#ffcf57] text-lg font-black text-[#0b2d2b] shadow-[inset_0_-2px_0_rgba(0,0,0,.12)]">W</span>
          <span>Walk City</span>
        </div>

        <div className="relative z-[2] mt-[clamp(70px,11vh,128px)] max-w-[520px] max-[900px]:mt-[18px] max-[560px]:max-w-[69%]">
          <span className="block text-xs font-extrabold tracking-[.19em] text-[#71d1b1] max-[900px]:hidden">WALK. BUILD. GROW.</span>
          <h2 className="mt-[21px] mb-[18px] text-[clamp(36px,4vw,58px)] leading-[1.13] tracking-[-.055em] text-[#fffef4] max-[900px]:my-2.5 max-[900px]:text-[31px] max-[560px]:text-[26px]">歩いた分だけ、<br />あなたの街が育っていく。</h2>
          <p className="max-w-[430px] text-[15px] leading-[1.8] text-[rgba(242,248,239,.68)] max-[900px]:max-w-[380px] max-[900px]:text-xs max-[560px]:hidden">毎日の一歩をコインに変えて、あなただけの街をつくろう。</p>
        </div>

        <BrandScene />

        <div className="relative z-[2] mt-[21px] flex items-center gap-[13px] text-[11px] text-white/60 max-[900px]:hidden">
          <span className="flex [&>i]:-ml-[7px] [&>i]:grid [&>i]:h-7 [&>i]:w-7 [&>i]:place-items-center [&>i]:rounded-full [&>i]:border-2 [&>i]:border-[#0b2d2c] [&>i]:bg-[#d8ede4] [&>i]:text-[10px] [&>i]:font-black [&>i]:not-italic [&>i]:text-[#0a2929] [&>i:first-child]:ml-0 [&>i:first-child]:bg-[#ffcf57] [&>i:last-child]:bg-[#ff8f7f]"><i>Y</i><i>M</i><i>K</i></span>
          <p className="m-0"><b className="text-white">1,240人</b>が今週、街づくりを始めました</p>
        </div>
      </aside>

      <section className="flex min-h-svh flex-col bg-[linear-gradient(rgba(8,44,42,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(8,44,42,.025)_1px,transparent_1px),#f7f6f0] bg-[size:32px_32px]">
        <header className="flex min-h-[76px] items-center justify-end px-[clamp(26px,5vw,72px)] max-[900px]:min-h-[67px] max-[900px]:justify-between max-[900px]:px-[23px]">
          <div className="hidden items-center gap-3 font-extrabold tracking-[-.02em] text-[#0b302f] max-[900px]:flex max-[900px]:text-base">
            <span className="inline-grid h-9 w-9 place-items-center rounded-[11px_11px_11px_3px] bg-[#ffcf57] text-lg font-black text-[#0b2d2b] shadow-[inset_0_-2px_0_rgba(0,0,0,.12)] max-[900px]:h-[30px] max-[900px]:w-[30px] max-[900px]:text-sm">W</span>
            <b>Walk City</b>
          </div>
        </header>

        <div className="mx-auto box-border w-[min(100%,660px)] px-[clamp(28px,6vw,76px)] pt-[22px] pb-3 max-[900px]:pt-7 max-[560px]:px-[22px]">{children}</div>

        <footer className="mt-auto flex min-h-[61px] items-center justify-between px-[clamp(26px,5vw,72px)] text-[9px] text-[#969b98]">
          <span>© 2026 Walk City</span>
          <nav className="flex gap-[19px]" aria-label="フッターリンク">
            <Link className="text-inherit no-underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)]" to={paths.terms}>利用規約</Link>
            <Link className="text-inherit no-underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)]" to={paths.privacy}>プライバシー</Link>
            <a className="text-inherit no-underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(40,124,100,.32)]" href="#help">ヘルプ</a>
          </nav>
        </footer>
      </section>
    </main>
  )
}
