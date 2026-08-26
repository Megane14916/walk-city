export type HealthConnectionStatusProps = {
  connected: boolean
}

export function HealthConnectionStatus({
  connected,
}: HealthConnectionStatusProps) {
  return (
    <ol className="setup-progress" aria-label="設定の進行状況">
      <li className="is-complete">
        <span>✓</span>
        <div><b>Googleログイン</b><small>完了</small></div>
      </li>
      <li className={connected ? 'is-complete' : 'is-current'}>
        <span>{connected ? '✓' : '2'}</span>
        <div>
          <b>歩数を連携</b>
          <small>{connected ? '完了' : 'あと少し'}</small>
        </div>
      </li>
    </ol>
  )
}
