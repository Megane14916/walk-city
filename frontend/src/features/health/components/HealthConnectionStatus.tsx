export type HealthConnectionStatusProps = {
  connected: boolean
}

export function HealthConnectionStatus({
  connected,
}: HealthConnectionStatusProps) {
  const itemClass =
    'relative flex w-1/2 items-center gap-2.5 first:after:absolute first:after:top-4 first:after:left-[83px] first:after:h-px first:after:w-[calc(100%-104px)] first:after:bg-[#d3d7d1] first:after:content-[\'\'] max-[560px]:first:after:left-[72px] max-[560px]:first:after:w-[calc(100%-82px)] [&_b]:block [&_b]:text-[10px] [&_small]:mt-px [&_small]:block [&_small]:text-[9px] [&_small]:text-[#a0a5a2]'
  const stepClass =
    'grid h-[31px] w-[31px] place-items-center rounded-full border text-[10px] font-black'

  return (
    <ol className="m-0 mb-[31px] flex list-none gap-0 p-0" aria-label="設定の進行状況">
      <li className={`${itemClass} [&_b]:text-[#6e7774]`}>
        <span className={`${stepClass} border-[#4e9b7f] bg-[#4e9b7f] text-white`}>✓</span>
        <div><b>Googleログイン</b><small>完了</small></div>
      </li>
      <li className={`${itemClass} ${connected ? '[&_b]:text-[#6e7774]' : '[&_b]:text-[#143d39]'}`}>
        <span
          className={`${stepClass} ${
            connected
              ? 'border-[#4e9b7f] bg-[#4e9b7f] text-white'
              : 'border-[#ffcf57] bg-[#ffcf57] text-[#0e4540]'
          }`}
        >
          {connected ? '✓' : '2'}
        </span>
        <div>
          <b>歩数を連携</b>
          <small>{connected ? '完了' : 'あと少し'}</small>
        </div>
      </li>
    </ol>
  )
}
