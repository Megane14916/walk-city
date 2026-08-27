# 歩数・コイン連携機能 Design Doc / 実装計画書

| 項目 | 内容 |
|---|---|
| 対象プロダクト | Walk City |
| ステータス | Phase 0 基本契約確定（Phase 1 着手可能） |
| 作成日 | 2026-08-27 |
| 対象 | Edge Function による歩数同期・コイン付与結果の取得、Town 画面への反映 |
| 関連 API | `syncSteps()` / Supabase Edge Function `sync-health-steps` |

## 1. 概要

本機能は、認証済みユーザーの操作を契機に Supabase Edge Function を呼び出し、Google Health から取得・検証された歩数と、サーバーで計算・確定された獲得コインおよびコイン残高を Town 画面へ反映する。

フロントエンドは歩数、コイン付与量、建物ボーナス、残高を計算しない。Edge Function の成功レスポンスを一つの確定済みスナップショットとして扱い、「今日の歩数」と「所持コイン数」を同時に更新する。

本書は、既存の [フロントエンド設計書](./フロントエンド.md)、[フロントエンド詳細技術設計書](./frontend-architecture.md)、[API 設計書](./API計画書.md)、[バックエンド設計書](./バックエンド.md) を前提に、フロントエンドの実装範囲、データ契約、状態遷移、エラー処理、テスト、実装順序を定義する。

## 2. 仕様の優先順位

実装時は次の順で仕様を参照する。

1. API の関数名、リクエスト、レスポンス、エラーコード: [API 設計書](./API計画書.md)
2. フロントエンドの責務と信頼境界: [フロントエンド設計書](./フロントエンド.md)
3. ファイル配置、依存方向、状態管理: [フロントエンド詳細技術設計書](./frontend-architecture.md)
4. 歩数精算、冪等性、DB 更新: [バックエンド設計書](./バックエンド.md)

文書と実際の Edge Function の間に差異がある場合、フロントエンドで複数形式を推測して吸収する前にバックエンド担当と契約を確定し、`API計画書.md` と関連コードを同じ契約へ更新する。

## 3. 現状と課題

2026-08-27 時点のフロントエンドには、以下の実装がある。

- `TownOverview.tsx` は「今日の歩数」と「所持コイン数」を表示している。
- 今日の歩数は `useDailyStepsSummary()` から `GoogleIntegrationApi.getDailySteps()` を呼んで取得している。
- コインは `TownApi.getMyTown()` が返す `TownDetail.town.coins` を表示している。
- Supabase Edge Function 呼び出しは `features/auth/services/google-integration.ts` の共通 `invoke()` に集約されている。
- `useTownOverview()` は建物配置成功後の `coinBalance` と `population` をローカルの街状態へ反映している。
- `TownPage.tsx` は `mockTownApi` と `mockRankingApi` を直接 import しているため、`VITE_API_MODE=supabase` でも街データはモックのままである。

バックエンドについては、`sync-health-steps` Edge Function は未作成・未デプロイである。一方、`getMyTown()` は将来 Supabase に保存された実際の街データと最新コイン残高を返す実 API として実装する方針が確定している。

不足している点は以下である。

- `syncSteps()` と `StepSyncStatus` がフロントエンドコードにない。
- `sync-health-steps` を呼ぶ処理がない。
- Town 画面に同期ボタン、同期中、同期成功、同期失敗の UI がない。
- 同期成功時に歩数とコインを一貫して更新する状態更新経路がない。
- mock API で歩数同期と街のコイン残高が同じ状態を共有していない。
- Edge Function の HTTP エラー本文を `ApiError` へ正規化する処理が不足している。
- 現在の `origin/supabase` からは Edge Function 本体を確認できず、実装済み関数との結合確認ができない。

## 4. 目的と非目的

### 4.1 目的

- 認証済みユーザーが Town 画面から歩数同期を実行できる。
- `supabase.functions.invoke('sync-health-steps', { body: {} })` をサービス層から呼べる。
- クライアントから `userId`、歩数、付与コイン、日付、タイムゾーンを送信しない。
- Edge Function の `StepSyncStatus` を実行時に検証し、不正なレスポンスを UI に流さない。
- 成功時に今日の歩数とコイン残高を同じレスポンスから同時に更新する。
- 獲得コイン、同期日時、再同期で新規付与がなかったことを利用者へ通知できる。
- 同期中は二重送信を防止する。
- Health 未連携、権限不足、認証切れ、外部 API 障害、未知の障害を区別して案内する。
- 実 API と mock API が同じ公開インターフェースを実装する。
- 公開街では歩数、コイン、同期操作を表示しない。
- lint、単体テスト、コンポーネントテスト、build が成功する。

### 4.2 非目的

- Google Health から歩数を取得するバックエンド処理の実装
- 歩数からコインへの変換率、上限、端数処理の決定
- 商業施設・工場によるボーナス計算
- `daily_step_records`、`coin_ledger`、`towns` の更新処理
- Edge Function の冪等性実装
- Google Health OAuth の認可フロー変更
- コイン獲得アニメーションや複雑な演出
- リアルタイム購読や自動ポーリング
- 公開街への歩数・コイン表示

## 5. API 契約

### 5.1 関数名と呼び出し

API 設計書を正として、フロントエンドの公開関数名を `syncSteps()`、Edge Function 名を `sync-health-steps` とする。

```ts
const { data, error } = await supabase.functions.invoke(
  'sync-health-steps',
  { body: {} },
)
```

Supabase Browser Client が現在のセッションの JWT を送信する。本文に更新対象ユーザーを指定しない。認証ユーザーと対象の街はバックエンドが JWT から解決する。

### 5.2 リクエスト

```json
{}
```

以下は送信禁止とする。

- `userId`
- `steps`
- `coinsAwarded`
- `coinBalance`
- Google のアクセストークンまたは更新トークン
- クライアント時計から生成した精算対象日

### 5.3 成功レスポンス

```ts
export type AppliedBonus = {
  sourceBuildingType: string
  sourceCount: number
  effectType: string
  amount: number
}

export type StepSyncStatus = {
  date: string
  timezone: string
  steps: number
  newlyRewardedSteps: number
  coinsAwarded: number
  coinBalance: number
  appliedBonuses: AppliedBonus[]
  syncedAt: string
}
```

標準レスポンス envelope は次の形式とする。

```json
{
  "ok": true,
  "data": {
    "date": "2026-08-27",
    "timezone": "Asia/Tokyo",
    "steps": 6500,
    "newlyRewardedSteps": 1500,
    "coinsAwarded": 150,
    "coinBalance": 850,
    "appliedBonuses": [],
    "syncedAt": "2026-08-27T12:00:00+09:00"
  }
}
```

フロントエンドは各数値を 0 以上の `Number.isSafeInteger` として検証する。`date` は `YYYY-MM-DD`、`timezone` は空でない文字列、`syncedAt` は解釈可能な ISO 8601 文字列として検証する。`appliedBonuses` の各要素も検証し、一要素でも不正ならレスポンス全体を `INTERNAL_ERROR` とする。

`coinsAwarded` が `0` でも成功である。再同期時に新しい歩数がなければ、成功状態を保ったまま「新しく反映された歩数はありません」と表示する。

### 5.4 エラーレスポンス

標準エラー envelope は次の形式とする。

```json
{
  "ok": false,
  "error": {
    "code": "HEALTH_PERMISSION_REQUIRED",
    "message": "歩数を読み取る権限が必要です。"
  }
}
```

Edge Function が 4xx / 5xx を返し `supabase.functions.invoke()` が `FunctionsHttpError` を返した場合は、可能であれば `error.context.json()` から上記 envelope を安全に読み取り、既知の `ApiErrorCode` だけを採用する。本文の解析に失敗した場合は HTTP ステータスと処理種別に応じた一般エラーへ変換する。外部 API の本文、SQL、スタック、トークンは画面や console に出さない。

### 5.5 Phase 0 で確定した契約

2026-08-27 にフロントエンド・バックエンド間の基本契約として次を確定した。

| 項目 | 確定内容 |
|---|---|---|
| Edge Function 名 | `sync-health-steps` |
| 実装状況 | 未作成・未デプロイ。これから新規作成する |
| リクエスト | 空 object `{}`。ユーザー、歩数、コイン、日付、タイムゾーンを送信しない |
| 成功 envelope | `{ ok: true, data: StepSyncStatus }` |
| エラー envelope | `{ ok: false, error: { code, message } }` |
| 日付境界 | 初期リリースは `Asia/Tokyo` 固定 |
| `appliedBonuses.amount` | 追加付与コインを表す 0 以上の整数 |
| 初期残高の取得 | 実 `getMyTown()` が Supabase に保存された最新の `towns.coins` を返す |

`health_steps_fetch`、`get-daily-steps`、`{ status: "ok" }` など既存文書・移行中コードに残る別名や旧 envelope は、新しい歩数精算 API の契約として使用しない。実装時に関連文書も上表へ統一する。

HTTP status と `ApiErrorCode` の対応、ローカル Function URL、CORS、Secrets は Edge Function 実装時に確定する運用詳細である。これらは Phase 1 のフロントエンド型・mock 実装を妨げないが、実 Edge Function との結合確認を行う Phase 5 までに確定する。

## 6. アーキテクチャ

### 6.1 依存方向

```text
TownPage / TownOverview
        ↓
useStepSync（同期状態とユースケース）
        ↓
StepSyncApi（公開インターフェース）
        ↓
SupabaseStepSyncApi / MockStepSyncApi
        ↓
Supabase Edge Function / 共有 Mock Store
```

`TownOverview.tsx` から Supabase Client、関数名、環境変数を直接参照しない。UI は `StepSyncApi` と `ApiResult<StepSyncStatus>` だけを扱う。

### 6.2 API 境界

Google ログイン・Health 認可の API と、ゲーム上の歩数精算 API は責務が異なるため、次の小さなインターフェースを追加する。

```ts
export interface StepSyncApi {
  syncSteps(): Promise<ApiResult<StepSyncStatus>>
}
```

`GoogleIntegrationApi` へ精算処理を直接追加せず、`features/health/api/` に `StepSyncApi` を置く。既存の `getDailySteps()` は Health 接続画面または移行期間の表示取得に限定し、コイン付与や残高更新には使用しない。

### 6.3 状態の所有者

- 同期中、直近の同期結果、同期エラー、成功通知は `useStepSync()` が所有する。
- 街、建物、現在のコイン残高は `useTownOverview()` が所有する。
- 同期成功時、`useTownOverview()` が公開する `applyStepSyncResult()` に `StepSyncStatus` を渡し、`town.town.coins` を `coinBalance` で置き換える。
- `TownOverview` は `StepSyncStatus.steps` を今日の歩数として表示する。
- `coinsAwarded` を既存残高へ加算して新残高を推測しない。必ず `coinBalance` で置き換える。

同期レスポンスの適用は一つのイベントとして行う。React の別々の非同期取得結果を組み合わせて残高を計算しない。

### 6.4 初期表示

初期実装では、既存の挙動を維持して次のデータを表示する。

- 今日の歩数: Health 接続済みの場合のみ `getDailySteps()` の結果
- 所持コイン: Supabase に保存された実際の街データを取得する `getMyTown()` の `town.coins`
- 同期操作後: `syncSteps()` の `steps` と `coinBalance` を両方の表示へ適用

`getMyTown()` の実装方式は Supabase Query、RPC、Edge Function のいずれでもよい。フロントエンドは通信方式を `TownApi` の内側へ隠し、JWT から本人の街を特定して最新の `towns.coins` を取得する。複数テーブルから `TownDetail` を一括取得する必要がある場合は、`get_my_town` のような RPC を推奨する。

バックエンドの `getDashboard()` が将来利用可能になった場合は、初期歩数、初期コイン、最終同期日時を一つの Dashboard レスポンスから取得し、`getDailySteps()` の Town 画面での自動呼び出しを廃止してよい。初期リリースでは `getDashboard()` を必須にせず、実 `getMyTown()` と既存の歩数読み取りを使用する。`syncSteps()` を画面表示時に自動実行して初期値を得る設計にはしない。

## 7. 変更するファイル

実装時の想定構成は以下とする。ファイル名は既存命名規則に合わせて調整してよいが、責務分離は維持する。

```text
frontend/src/
├── app/
│   ├── providers/
│   │   ├── api-context.ts                 # stepSyncApi を追加
│   │   └── create-api-services.ts         # mock / supabase 実装を生成
│   └── routes/
│       └── TownPage.tsx                   # Provider から API を受け取る
├── features/
│   ├── health/
│   │   ├── api/
│   │   │   ├── step-sync-api.ts           # StepSyncApi
│   │   │   └── index.ts
│   │   ├── hooks/
│   │   │   ├── useStepSync.ts             # 状態・二重送信防止
│   │   │   └── useStepSync.test.ts
│   │   ├── services/
│   │   │   ├── step-sync.ts               # Edge Function 呼び出し・検証
│   │   │   ├── step-sync.test.ts
│   │   │   └── index.ts
│   │   └── types.ts                       # StepSyncStatus 等を追加
│   └── town/
│       ├── components/
│       │   └── TownOverview.tsx            # 同期ボタンと結果表示
│       └── hooks/
│           └── useTownOverview.ts          # coinBalance の適用関数
├── mocks/
│   ├── data/
│   │   └── health.ts                       # 同期結果の初期値
│   └── services/
│       ├── step-sync.ts                    # 同一契約の mock
│       └── index.ts
└── types/
    └── common.ts                           # 必要なエラーコードのみ追加
```

`TownPage.tsx` の `mockTownApi` 直接 import は解消し、`ApiProvider` から `townApi` と `stepSyncApi` を取得する。Supabase モードで実データとモックデータが混在しないようにする。

## 8. 処理フロー

### 8.1 同期成功

```text
利用者が「歩数を同期」を押す
  ↓
useStepSync が pending を確認
  ├─ すでに pending → 何もしない
  └─ idle / success / error
       ↓
    pending に変更、前回の操作エラーをクリア
       ↓
    StepSyncApi.syncSteps()
       ↓
    Supabase Edge Function sync-health-steps
       ↓
    レスポンス envelope と StepSyncStatus を検証
       ↓
    success 状態へ保存
       ↓
    steps と town.coins を同じ結果から更新
       ↓
    「6,500歩を同期し、150コイン獲得しました」を通知
```

`coinsAwarded === 0` かつ `newlyRewardedSteps === 0` の場合は「歩数は最新です。新しく付与されたコインはありません」と通知する。成功をエラーや警告として扱わない。

### 8.2 同期失敗

```text
Edge Function / 通信 / レスポンス検証に失敗
  ↓
ApiError へ正規化
  ↓
既存の歩数とコイン表示を維持
  ↓
エラー文と再試行操作を表示
```

失敗時に歩数またはコインの一方だけを更新しない。結果不明の通信失敗でも成功を推測しない。再試行による二重付与防止はバックエンドの冪等性を正とする。

### 8.3 建物購入との競合

同期と建物購入が近い時刻に完了すると、後から届いた古い残高で表示を巻き戻す可能性がある。初期実装では残高更新操作を同時に実行できないよう、次を採用する。

- 歩数同期中は購入・配置の確定ボタンを無効にする。
- 購入・配置送信中は歩数同期ボタンを無効にする。
- 将来操作を並行可能にする場合は、レスポンスへ残高バージョンまたは `updatedAt` を含め、古い結果を破棄する。
- `CONFLICT` または結果の順序を保証できない状態では `getMyTown()` を再取得する。

## 9. Hook の状態設計

`useStepSync()` は次の状態を公開する。

```ts
type StepSyncState = {
  latest: StepSyncStatus | null
  isSyncing: boolean
  error: ApiError | null
  sync: () => Promise<ApiResult<StepSyncStatus>>
  clearError: () => void
}
```

状態遷移は次のとおりとする。

```text
idle
  └─ sync → syncing
              ├─ success → succeeded
              │              └─ sync → syncing
              └─ failure → failed
                             └─ retry → syncing
```

実装上は `useRef` でも pending を保持し、同一レンダー内の連続クリックでも二重呼び出しにならないようにする。アンマウント後、公開街へのルート変更後、API 実装の差し替え後に古い結果を適用しない。

## 10. TownOverview UI

### 10.1 表示内容

自分の街のヘッダーに以下を表示する。

- 今日の歩数
- 所持コイン数
- 「歩数を同期」ボタン
- 同期中表示
- 同期成功または失敗の短い通知
- 必要に応じて最終同期日時

既存の歩数カードとコインカードの見た目を維持し、同期ボタンを同じダッシュボード領域へ追加する。320 px 幅ではカードとボタンが画面外へ押し出されないよう、既存の横スクロール可能なナビゲーション内で最小幅と折り返しを確認する。

### 10.2 状態別表示

| 状態 | 歩数 | コイン | 同期操作 |
|---|---|---|---|
| 初期読込中 | `確認中…` | Town 読込中 UI | 無効 |
| Health 未連携 | `未連携` | 現在残高 | 「Healthを連携」への導線 |
| 権限再同意が必要 | `再連携が必要` | 現在残高 | 再連携導線 |
| 接続済み・待機 | 現在値 | 現在残高 | 「歩数を同期」 |
| 同期中 | 現在値を維持 | 現在値を維持 | 「同期中…」、disabled |
| 同期成功 | レスポンスの `steps` | レスポンスの `coinBalance` | 再実行可 |
| 同期失敗 | 前回値を維持 | 前回値を維持 | エラーと「再試行」 |

ボタンの最小タップ領域は 44×44 px とし、読み込み状態を色だけで表現しない。通知領域には `role="status"`、操作失敗には `role="alert"` または適切な `aria-live` を使用する。

### 10.3 成功メッセージ

- `coinsAwarded > 0`: `6,500歩を同期し、150コイン獲得しました。`
- `newlyRewardedSteps > 0 && coinsAwarded === 0`: `1,500歩を新しく同期しました。今回の獲得コインは0です。`
- 両方 0: `歩数は最新です。新しく付与されたコインはありません。`

`appliedBonuses` は初期リリースでは詳細一覧を常時表示しない。表示する場合も `amount` を再計算せず、レスポンス値を説明として表示する。

### 10.4 公開街

`mode.type === 'public'` の場合は以下を一切描画・実行しない。

- 今日の歩数
- 所持コイン
- 同期ボタン
- 同期結果、獲得コイン、ボーナス
- `syncSteps()` 呼び出し

## 11. エラー処理

| `ApiErrorCode` | UI の扱い | 主な導線 |
|---|---|---|
| `UNAUTHENTICATED` | セッション切れを通知 | `/login` への再ログイン導線 |
| `HEALTH_NOT_CONNECTED` | Health 未連携として表示 | `/health/connect` |
| `HEALTH_PERMISSION_REQUIRED` | 権限の再同意が必要と表示 | 再連携操作 |
| `HEALTH_PROVIDER_ERROR` | Google Health との通信失敗 | 同じ画面で再試行 |
| `CONFLICT` | 状態競合として表示 | 街データ再取得後に再試行 |
| `INVALID_INPUT` | 契約または入力異常 | 一般メッセージ、開発時にテストで検出 |
| `INTERNAL_ERROR` | 予期しないエラー | 一般メッセージと再試行 |

既知でないエラーコードは `INTERNAL_ERROR` に正規化する。サーバーの `message` は表示可能な契約であっても、空文字や過度に長い文字列はフロントエンドの一般メッセージへ置換する。

## 12. Supabase サービス実装方針

サービス層は以下を担当する。

1. Edge Function を空本文で呼び出す。
2. Supabase SDK の通信エラーと HTTP エラーを捕捉する。
3. エラー本文を既知の `ApiError` へ正規化する。
4. 成功 envelope と `StepSyncStatus` を実行時に検証する。
5. `ApiResult<StepSyncStatus>` を返す。

概略実装は次の形とする。

```ts
export function createSupabaseStepSyncApi(
  supabase: SupabaseClient,
  options: { functionName?: string } = {},
): StepSyncApi {
  const functionName = options.functionName ?? 'sync-health-steps'

  return {
    async syncSteps() {
      try {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: {},
        })

        if (error) return parseFunctionsError(error)
        return parseStepSyncResult(data)
      } catch {
        return {
          ok: false,
          error: {
            code: 'HEALTH_PROVIDER_ERROR',
            message: '歩数を同期できませんでした。',
          },
        }
      }
    },
  }
}
```

これは設計用の概略であり、実装時は既存 `google-integration.ts` の型ガード、エラーコード集合、メッセージを共通 helper へ抽出するか、重複が小さい場合は Health service 内へ閉じ込める。過度な共通化で認証機能を不安定にしない。

## 13. Mock 設計

`MockStepSyncApi` は実 API と同じ `StepSyncApi` を実装し、次を再現する。

- 初回同期で歩数差分とコインが増える。
- 同じ歩数の再同期では `newlyRewardedSteps: 0`、`coinsAwarded: 0` になる。
- 歩数を増やした後の再同期では差分だけを返す。
- Health 未連携、権限不足、外部 API 失敗、認証切れを注入できる。
- 疑似遅延を設定できる。
- 固定時計を注入できる。

mock モードでは `MockStepSyncApi` と `MockTownApi` が同じ `MockWalkCityStore` を参照する。同期結果の `coinBalance` と、その後 `getMyTown()` が返す `town.coins` は必ず一致させる。画面のローカル表示だけを変更して mock の永続状態を更新しない実装は禁止する。

モックのコイン変換率は本番ルールの複製ではなく、テスト fixture として明示する。UI テストは変換式そのものではなく、API が返した `coinsAwarded` と `coinBalance` をそのまま表示・適用することを検証する。

## 14. テスト計画

### 14.1 サービス単体テスト

- `sync-health-steps` を本文 `{}` で一度だけ呼ぶ。
- `userId`、歩数、コイン、タイムゾーンを送らない。
- 正常 envelope を `ApiResult<StepSyncStatus>` へ変換する。
- 数値が負、小数、`NaN`、safe integer 外の場合は拒否する。
- `date`、`timezone`、`syncedAt`、`appliedBonuses` が不正な場合は拒否する。
- 既知の 4xx エラー本文を対応する `ApiErrorCode` へ変換する。
- 解析不能な HTTP エラーとネットワーク例外を一般エラーへ変換する。
- エラー詳細、トークン、外部レスポンスを返却・出力しない。

### 14.2 Hook 単体テスト

- 初期状態は `isSyncing: false` である。
- 同期中だけ `isSyncing: true` になる。
- 連続実行しても API を一度だけ呼ぶ。
- 成功結果を `latest` に保持する。
- 失敗時は前回成功値を維持し、`error` だけを更新する。
- 再試行に成功するとエラーをクリアする。
- アンマウント後または API 変更後に古い結果を適用しない。

### 14.3 TownOverview コンポーネントテスト

- 自分の街で同期ボタンが表示される。
- 公開街では歩数、コイン、同期ボタンが表示されない。
- Health 未連携では Edge Function を呼ばず連携導線を表示する。
- 同期中はボタンと購入確定操作が無効になる。
- 成功時に `steps` と `coinBalance` が同時に更新される。
- `coinsAwarded` を既存残高へ加算せず、`coinBalance` を表示する。
- 0コイン成功を正しく通知する。
- 失敗時に直前の歩数とコインを保持する。
- 権限不足時に再連携導線を表示する。
- キーボード操作と live region が機能する。

### 14.4 Provider・統合テスト

- mock モードで mock の StepSync / Town API が生成される。
- supabase モードで同一 Supabase Client を使う実 API が生成される。
- 不正な `VITE_API_MODE` は起動時に検出される。
- mock 同期後に Town を再取得しても更新済み残高が返る。
- セッション切れ時に認証フローへ戻れる。

### 14.5 回帰確認

- 建物配置後のコイン残高更新が維持される。
- ランキングパネルとマーケットパネルが従来どおり開閉する。
- Town Map のパン、ズーム、配置プレビューが動作する。
- `/town/:userId` に非公開情報が漏れない。
- `npm test`、`npm run lint`、`npm run build` が成功する。

## 15. 実装フェーズ

### Phase 0: バックエンド基本契約の確定（完了）

1. `sync-health-steps` を新規 Edge Function 名として確定した。
2. リクエストを空 object `{}` とし、本人は JWT から特定することを確定した。
3. 成功を `{ ok: true, data: StepSyncStatus }`、失敗を `{ ok: false, error }` として確定した。
4. `StepSyncStatus` のフィールドを非 null とし、0 以上の整数と日時文字列で構成する契約を確定した。
5. 日付境界とレスポンスの `timezone` を `Asia/Tokyo` として確定した。
6. `appliedBonuses.amount` を追加付与コインを表す 0 以上の整数として確定した。
7. 実 `getMyTown()` が Supabase に保存された街データと最新残高を返す方針を確定した。

次の運用詳細は Edge Function の作成時に決定し、Phase 5 の結合確認までに本書へ追記する。

- HTTP status と `ApiErrorCode` の対応
- JWT 検証失敗、Health 未連携、権限不足の具体的な HTTP status
- ローカル Function URL、CORS、Secrets、fixture の利用方法

### Phase 1: 型と API 境界

1. `StepSyncStatus` と `AppliedBonus` を `features/health/types.ts` に追加する。
2. `StepSyncApi` を `features/health/api/` に追加する。
3. 型ガードと envelope parser を実装する。
4. Supabase 実 API のサービス単体テストを追加する。

### Phase 2: Supabase / Mock 実装と Provider

1. `createSupabaseStepSyncApi()` を追加する。
2. `createMockStepSyncApi()` を追加する。
3. mock の共有 Store を導入し、Town と StepSync の残高を同期する。
4. `ApiServices` に `stepSyncApi` と `townApi` を追加する。
5. `createApiServices()` が API mode に応じて実装を生成する。
6. `TownPage.tsx` の `mockTownApi` 直接 import を削除する。

Supabase 用 `TownApi` は、Supabase に保存された実際の街データを返すものとして実装する。実装完了までは、実データとモックデータを混在させないため `VITE_API_MODE=supabase` の Town 画面を未完成のまま公開しない。少なくとも `getMyTown()` が実残高を返す経路をバックエンド担当と接続する。

### Phase 3: Hook と状態整合性

1. `useStepSync()` を実装する。
2. pending の二重ガードと stale response 対策を追加する。
3. `useTownOverview()` に `applyStepSyncResult()` を追加する。
4. 同期と建物配置の相互 disabled を実装する。
5. `CONFLICT` 時の Town 再取得を実装する。

### Phase 4: UI

1. `TownOverview.tsx` に同期ボタンを追加する。
2. 初期歩数、同期後歩数、未連携、権限不足を表示する。
3. 同期成功、0件同期、同期失敗の通知を追加する。
4. `coinBalance` でコイン表示を更新する。
5. 公開街で非表示・未実行であることを確認する。
6. 320 px から PC 幅までレイアウトとタップ領域を確認する。

### Phase 5: テスト・文書・結合確認

1. サービス、Hook、UI、Provider のテストを追加する。
2. mock と Supabase の契約テストを共通 fixture で実行する。
3. ローカルまたは preview 環境で実 Edge Function を呼ぶ。
4. 同一歩数で複数回同期し、二重付与されないことを確認する。
5. 歩数を増やした後、差分だけが反映されることを確認する。
6. ネットワーク失敗後の再試行で残高が二重増加しないことを確認する。
7. 関数名、envelope、タイムゾーンを関連文書へ反映する。
8. lint、test、build を実行する。

## 16. 完了条件

- `syncSteps()` が実際に `sync-health-steps` Edge Function を呼ぶ。
- クライアントから歩数、コイン、対象ユーザー ID を送っていない。
- 成功レスポンスが実行時検証されている。
- 歩数とコイン残高が一つの `StepSyncStatus` から同時に反映される。
- 同期中の二重送信と、同期・購入の残高競合が防止されている。
- 失敗時に既存表示を維持し、再試行できる。
- 未連携・権限不足・認証切れを区別して案内できる。
- 公開街で歩数・コイン・同期情報が一切表示されない。
- mock 同期後の再取得でもコイン残高が巻き戻らない。
- supabase モードで Town 画面に mock の街・コインが混入しない。
- Edge Function との結合テストで同一歩数の二重付与が起きない。
- `npm test`、`npm run lint`、`npm run build` がすべて成功する。
- API 契約と実装に合わせて関連ドキュメントが更新されている。

## 17. リスクと対策

| リスク | 対策 |
|---|---|
| Edge Function 実装が確定済み契約から逸脱する | 契約テストで検出し、実装または API 設計書を同じ変更で更新する |
| HTTP エラー本文を取得できず詳細コードが失われる | `FunctionsHttpError.context` を安全に解析し、失敗時は一般コードへフォールバックする |
| React StrictMode や連打で二重実行される | 自動同期を行わず、Hook 内の ref と button disabled で防止する |
| 再試行で二重付与される | サーバーの `rewarded_steps` と台帳の冪等性を結合テストする |
| 同期と購入の応答順で残高が巻き戻る | 初期版は同時操作を禁止し、競合時に Town を再取得する |
| UI だけ更新され mock / DB の残高と不一致になる | 共有 Mock Store と実 `getMyTown()` を同時に接続する |
| 不正レスポンスで `NaN` や負数が表示される | サービス層で全フィールドを型ガードする |
| タイムゾーン固定で日付がずれる | 同期結果の `date` と `timezone` を表示の正とし、クライアント固定値を精算に使わない |
| 公開街に非公開値が漏れる | public mode の非表示テストと API レスポンスの契約テストを維持する |

## 18. Phase 0 確認記録

基本契約は確認済みであり、Phase 1 のフロントエンド実装を開始できる。

- [x] Function 名は `sync-health-steps` で確定している。
- [x] Function は未作成・未デプロイであり、確定契約に沿って新規作成する。
- [x] リクエストは空 object `{}` である。
- [x] 成功 envelope は `{ ok: true, data }` である。
- [x] 失敗 envelope は `{ ok: false, error: { code, message } }` である。
- [x] `StepSyncStatus` は本書記載のフィールドを返し、各フィールドは非 null である。
- [x] `coinsAwarded` と `coinBalance` は 0 以上の整数である。
- [x] `appliedBonuses.amount` は追加付与コインを表す 0 以上の整数である。
- [x] 日付境界と返却 `timezone` は `Asia/Tokyo` である。
- [x] `getMyTown()` は Supabase に保存された実際の街データと最新コイン残高を返す。

以下は Edge Function／実 Town API の作成時に確認する。

- [ ] エラー時の HTTP status と `ApiErrorCode` の対応は何か。
- [ ] 同一データ・通信再送・同時実行に対する冪等性が実装済みか。
- [ ] ローカル開発用の Function URL、CORS、必要な環境変数が準備されているか。
