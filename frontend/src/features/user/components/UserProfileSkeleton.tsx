export function UserProfileSkeleton() {
  return (
    <section
      className="mx-auto w-full max-w-[760px] px-[clamp(18px,5vw,46px)] pt-[clamp(28px,6vw,64px)] pb-14 max-[420px]:px-3.5"
      role="status"
      aria-label="公開プロフィールを読み込み中"
      aria-busy="true"
    >
      <span className="sr-only">公開プロフィールを読み込んでいます…</span>
      <div className="h-11 w-36 animate-pulse rounded-xl bg-[#e5e9e3] motion-reduce:animate-none" aria-hidden="true" />
      <div className="mt-5 overflow-hidden rounded-[28px] border border-[#dce1da] bg-[rgba(255,255,255,.82)]" aria-hidden="true">
        <div className="h-28 animate-pulse bg-[#e4ece6] motion-reduce:animate-none max-[480px]:h-24" />
        <div className="px-[clamp(20px,5vw,44px)] pb-[clamp(24px,5vw,42px)]">
          <span className="-mt-12 block h-24 w-24 animate-pulse rounded-[30px_30px_30px_9px] border-[6px] border-white bg-[#d4ded7] motion-reduce:animate-none max-[480px]:-mt-10 max-[480px]:h-20 max-[480px]:w-20" />
          <span className="mt-6 block h-3 w-28 animate-pulse rounded-full bg-[#e3e8e2] motion-reduce:animate-none" />
          <span className="mt-4 block h-10 w-3/4 animate-pulse rounded-xl bg-[#e3e8e2] motion-reduce:animate-none" />
          <span className="mt-4 block h-4 w-2/3 animate-pulse rounded-full bg-[#edf0ec] motion-reduce:animate-none" />
          <div className="mt-7 grid grid-cols-[minmax(0,1fr)_132px] gap-5 rounded-[20px] border border-[#e3e7e1] bg-[#f7faf5] p-6 max-[480px]:grid-cols-1">
            <span className="h-12 animate-pulse rounded-xl bg-[#e3e8e2] motion-reduce:animate-none" />
            <span className="h-12 animate-pulse rounded-xl bg-[#e3e8e2] motion-reduce:animate-none" />
          </div>
          <span className="mt-6 block h-[54px] animate-pulse rounded-[15px] bg-[#d7e1da] motion-reduce:animate-none" />
        </div>
      </div>
    </section>
  )
}
