# Walk City フロントエンド 本番 Supabase 接続実装計画書

| 項目 | 内容 |
|---|---|
| 対象 | `walk-city/frontend` の本番 Supabase 接続 |
| ステータス | Draft（バックエンド契約確認待ち） |
| 再調査日 | 2026-08-28 |
| 調査基準 | `main` / `549b1cb` |
| 上位仕様 | `フロントエンド.md`、`frontend-architecture.md`、`API計画書.md` |

## 1. 目的

モックで完成している街表示・街編集・ランキングを本番 Supabase へ接続し、`VITE_API_MODE=supabase` で主要機能を一貫して動作させる。（`/users/:userId` ユーザーページは[ユーザーページDesignDoc.md](./ユーザーページDesignDoc.md)の決定により実装しない）

本計画では、フロントエンドに不足している Town / Ranking の Supabase Service、Provider への接続、レスポンス検証、エラー変換、デプロイ設定、契約テストを実装対象とする。

コイン、人口、価格、建物効果、配置可否、ランキング順位はサーバーを正とし、フロントエンドで確定しない。

## 2. 今回の方針

### 2.1 `getDashboard()` は実装しない

今回の本番接続では `getDashboard()` を追加しない。画面に必要な値は現在の構成を維持し、次の既存 API から取得する。

| 表示値 | 取得元 |
|---|---|
| ユーザー、街名、コイン、人口 | `getMyTown()` |
| 今日の歩数 | 初期表示は未同期状態。ユーザー操作後は`syncSteps()`の成功レスポンス |
| Health 接続状態、最終同期日時 | `getGoogleIntegrationState()` |
| 建物、開放領域、障害物 | `getMyTown()` / `getPublicTown()` |
| 建物価格、サイズ、効果、有効状態 | `getBuildingCatalog()` |

実装時に `フロントエンド.md`、`frontend-architecture.md`、`API計画書.md` の `getDashboard()` を必須 API としている記述を更新する。バックエンド側に既に `getDashboard()` が存在しても、今回のフロントエンドからは使用しない。

### 2.2 ランキングは取得時点のサーバー人口を正とする

モックでは Town API と Ranking API が同じ `MockWalkCityStore` を共有し、建物配置による人口増減が次のランキング取得へ反映されるようになった。

本番ではクライアント共有Storeでランキングを再計算せず、`getPopulationRanking()` が呼ばれるたびにバックエンドの最新人口と順位を返す。街編集成功後にランキングを開く、再表示する、または更新すると、最新順位を取得する。

Supabase Realtime による常時購読は今回の必須要件に含めない。ランキングを開いたまま他ユーザーの人口変動を自動反映する要件が追加された場合に別途検討する。

## 3. 最新コードの調査結果

### 3.1 実装状況一覧

| 機能 | API interface / UI | モック | Supabase Service | 現在の Supabase モード |
|---|---|---|---|---|
| Supabase Client / 環境変数 | 実装済み | ― | 実装済み | URL と公開キーから Client を生成 |
| Google ログイン・セッション・ログアウト | 実装済み | 実装済み | 実装済み | Supabase Auth を使用 |
| Google Health 連携 | 実装済み | 実装済み | Edge Function 呼び出し実装済み | 実環境との照合が必要 |
| 歩数・コイン同期 | 実装済み | 実装済み | `sync-health-steps` 実装済み | 実環境との照合が必要 |
| 建物カタログ取得 | 実装済み | 実装済み | 未実装 | 準備中エラー |
| 自分の街取得 | 実装済み | 実装済み | 未実装 | 準備中エラー |
| 公開街取得 | 実装済み | 実装済み | 未実装 | 準備中エラー |
| 建物購入・配置 | 実装済み | 実装済み | 未実装 | 準備中エラー |
| 建物移動 | Hook、プレビュー、確認UIまで実装済み | 実装済み | 未実装 | 準備中エラー |
| 道路一括配置 | 実装済み | 実装済み | 未実装 | 準備中エラー |
| 建物名変更 | 実装済み | 実装済み | 未実装 | 準備中エラー |
| 土地開放 | 実装済み | 実装済み | 未実装 | 準備中エラー |
| 人口ランキング | Provider、画面、ページングまで実装済み | 共有Store対応済み | 未実装 | 準備中エラー |

### 3.2 最新マージで解消された事項

以前の計画に記載した次の問題は、現在の `main` では解消済みである。

1. `ApiServices` に `rankingApi` が追加された。
2. `TownPage.tsx` と `RankingPage.tsx` から `mockRankingApi` の直接 import が削除された。
3. mock モードでは Town、StepSync、Ranking が同じ `MockWalkCityStore` を共有する。
4. ランキング取得時に現在ユーザーの最新人口を共有Storeから読み、並べ替えと順位の再計算を行う。
5. Supabase モードには mock を混ぜず、未実装の Ranking API が明示的な準備中エラーを返す。
6. `moveBuilding()` が `useTownOverview()` から呼べるようになった。
7. 建物詳細から移動モードを開始し、移動先プレビュー、確認、キャンセル、成功反映ができる。
8. 移動時は対象自身を衝突判定から除外し、同じ `requestId` による冪等性をモックで検証できる。

ランキングのProvider統合や建物移動UIの新規実装は本計画の作業対象から除外する。本番用Serviceと契約テストのみを追加する。

## 4. 現在残っている問題

### 4.1 Supabase Town API が全操作スタブ

`frontend/src/app/providers/create-api-services.ts` の `createUnavailableSupabaseTownApi()` は、次の全操作で固定の `INTERNAL_ERROR` を返す。

- `getBuildingCatalog()`
- `getMyTown()`
- `getPublicTown()`
- `placeBuilding()`
- `placeRoadLine()`
- `moveBuilding()`
- `renameBuilding()`
- `unlockLand()`

`useTownOverview()` は街とカタログを並列取得するため、認証後のトップ画面を表示するには `getMyTown()` と `getBuildingCatalog()` の両方が必要である。街取得だけを先行実装しても画面は表示できない。

### 4.2 Supabase Ranking API がスタブ

Providerへの統合は完了しているが、`createUnavailableSupabaseRankingApi()` が固定の準備中エラーを返す。本番用 `createSupabaseRankingApi()` が必要である。

### 4.3 マーケット表示は固定10商品とする

マーケットに表示する名前、価格、サイズ、効果は`features/market/data/market-items.ts`の固定10商品を正とする。購入・配置できるかどうかは、Supabaseから取得した`BuildingCatalogItem[]`の`code`、`enabled`、`costCoins`を参照する。土地開放は建物カタログ外のローカル商品として表示する。

旧フロントエンドcodeは次の正式codeへ統一した。

| 正式code | 旧フロントエンドcode |
|---|---|
| `small_house` | `house-small` |
| `small_park` | `park` |
| `commercial` | `commercial-facility` |
| `town_hall` | `city-hall` |

住宅（大）は`apartment`を正式codeとして本番採用する。

### 4.4 正式 API 契約と現行 UI に差がある

- `placeRoadLine()` は現行 UI とモックにあり、`API計画書.md` §9 の正式な街編集 API として実装対象に確定済みである（[本番Supabase接続Phase0契約決定書.md](./本番Supabase接続Phase0契約決定書.md) §3.1）。
- `unlockLand()` は20×20・1000コインの正式なMVP機能として採用済みである。
- `unlockLand()` の入力は `{ x, y, requestId }`（座標ベース）に統一した（[API計画書.md](./API計画書.md) §9、[本番Supabase接続Phase0契約決定書.md](./本番Supabase接続Phase0契約決定書.md) §7.4）。
- `renameBuilding()` は追加設計書にあり、`custom_name` 列は既に追加済みである。更新用の `rename_building` RPC の実装を待つ（[Supabaseバックエンド実装計画書.md](./Supabaseバックエンド実装計画書.md) §5.9）。

道路一括配置を複数回の `placeBuilding()` に分解すると原子性と冪等性を失うため行わない。`placeRoadLine()`と`unlockLand()`は実装対象として確定しているため本番へ接続する。

### 4.5 日次歩数のタイムゾーンが暫定値のまま

`useDailyStepsSummary()` とゲーム上の歩数同期 `syncSteps()` は、どちらも `Asia/Tokyo` を正とする。

`getDashboard()` を実装しないため、この暫定処理は残さず、日次歩数表示も `Asia/Tokyo` に統一する。クライアントから日付・タイムゾーンを送る既存契約を維持する場合でも、報酬計算は引き続き `syncSteps()` のサーバー判定だけを使用する。

### 4.6 本番設定漏れでモックへフォールバックする

`VITE_API_MODE` 未指定時は `mock` になる。本番デプロイで環境変数を設定し忘れると、誤ってモックデータを表示する可能性がある。

本番ビルドでは `VITE_API_MODE=supabase` を必須とし、モード、Supabase URL、publishable key の不足を起動時またはビルド時に明示的に失敗させる。

### 4.7 バックエンドの物理契約をリポジトリから確認できない

現在の `main` と `origin/supabase` には migration、Edge Function 実装、RPC 定義、DB生成型がなく、`supabase/config.toml` だけが存在する。

フロントエンドだけでは Table / View / RPC / Edge Function の物理名、引数、snake_case レスポンス、エラー形式を確定できない。

## 5. 実装前にバックエンド担当と固定する契約

1. 各ユースケースの通信方式と物理名
   - Table / View Query、RPC、Edge Function のどれを使うか
   - 関数名、View名、引数名
2. 読み取り API
   - `getBuildingCatalog()`
   - `getMyTown()`
   - `getPublicTown(userId)`
   - `getPopulationRanking(input)`
3. 更新 API
   - `placeBuilding(input)`
   - `moveBuilding(input)`
   - `placeRoadLine(input)`、`renameBuilding(input)`（採用確定）
   - `unlockLand(input)`（採用確定）
4. レスポンス
   - `ApiResult<T>` envelope の有無
   - DB の `snake_case` をどの層で `camelCase` にするか
   - null、整数、日時、`catalogVersion` の扱い
5. エラー
   - HTTP status / Postgres error / Edge Function error から `ApiErrorCode` への対応表
   - 401、403、404、409、入力エラーの返却形式
6. 認証・認可
   - 自分の街と更新対象ユーザーを JWT から決定すること
   - 更新時に街・建物の所有権を再検証すること
7. 公開範囲
   - 公開街とランキングに coins、email、歩数、Health 情報を含めないこと
8. 初回ユーザー
   - 初回ログイン時の profile / town 作成タイミングと冪等性
9. ランキング
   - 人口の正データ、順位計算、同率順位、安定ソート、最大 `limit`、cursor
   - 人口変更がランキング取得へ反映されるトランザクション境界
10. カタログ
    - 正式な building type code、価格、サイズ、効果、`assetKey`、version
11. 認証・Health
    - デプロイ済み Edge Function 名、OAuth callback URL、許可 Redirect URL

`getDashboard()` の物理契約は今回の確認対象に含めない。

## 6. 目標構成

```text
Page / Component
    ↓
Feature Hook
    ↓
Feature API interface（ApiResult<T>）
    ↓
Supabase Service / Mock Service
    ↓
共通 Supabase Client
    ↓
Auth / Edge Function / RPC / View
```

現在の `ApiServices` 構成を維持する。

```ts
type ApiServices = {
  googleIntegrationApi: GoogleIntegrationApi
  stepSyncApi: StepSyncApi
  rankingApi: RankingApi
  townApi: TownApi
}
```

`dashboardApi` は追加しない。コンポーネントから Supabase SDK、物理 RPC 名、モック実装を直接参照しない。

## 7. 実装フェーズ

### Phase 0: API 契約と本番対象機能の確定

1. 第5章の契約をバックエンド担当とレビューする。
2. 実 API の成功・主要エラーの request / response fixture を受け取る。
3. 正式な building type code を確定する。
4. `placeRoadLine()`、`renameBuilding()`、`unlockLand()`は実装対象として確定済み。
5. スコープ外の操作はSupabaseモードのUIで非表示または無効にする方法を決める。
6. `getDashboard()` を使用しない方針を関連文書へ反映する。

完了条件: 本番対象の全 API に物理名、引数、成功 fixture、エラー対応表がある。

### Phase 1: 共通 Supabase 通信基盤と本番設定

1. Function / RPC / Query のエラーを `ApiError` に変換する共通処理を追加する。
2. Town と Ranking の runtime validator を追加する。
3. 可能であれば Supabase CLI の生成型を物理 Query / RPC に適用する。
4. `VITE_API_MODE` の本番 fail-closed 化を行う。
5. `.env.example` と `frontend/README.md` にローカル、ステージング、本番設定を記載する。
6. Service Role Key、Google token、OAuth secret を `VITE_*` に置かないことを明記する。

主な変更候補:

- `frontend/src/lib/supabase-api.ts`（新規）
- `frontend/src/lib/supabase-config.ts`
- `frontend/src/types/database.generated.ts`（型生成を採用する場合）
- `frontend/.env.example`
- `frontend/README.md`

### Phase 2: 読み取り Town API

1. `createSupabaseTownApi(supabase, options)` を追加する。
2. `getBuildingCatalog()` を View / RPC へ接続する。
3. `getMyTown()` を接続する。
4. `getPublicTown(userId)` を接続する。
5. `TownDetail` と `BuildingCatalogItem[]` を runtime 検証する。
6. 自分の街では `editable: true` と coins の存在を検証する。
7. 公開街では `editable: false` と非公開項目の不在を検証する。
8. `createUnavailableSupabaseTownApi()` を実 Service に置き換える。

主な変更候補:

- `frontend/src/features/town/services/town.ts`（新規）
- `frontend/src/features/town/services/index.ts`（新規）
- `frontend/src/app/providers/create-api-services.ts`

完了条件: Supabaseモードで `/`、`/town/:userId` が実データを表示する。

### Phase 3: 固定10商品UIと本番カタログの接続

1. Phase 3直前のマーケットUIデザインを維持する。
2. マーケットは住宅（小）、住宅（大）、公園、病院、商業施設、農場、道路、役所、工場、土地開放の10商品を表示する。
3. 建物商品の購入可否はAPIカタログの`enabled`と`costCoins`で判定する。
4. 土地開放は通常の建物カタログと分離したローカル商品として表示する。
5. 住宅（大）の正式codeを`apartment`とし、モックと本番カタログ契約へ追加する。
6. 工場は効果なしとする。

完了条件: 10商品の旧UIが表示され、建物商品の操作可否は本番カタログに従い、土地開放は従来どおり操作できる。

### Phase 4: `placeBuilding()` と `moveBuilding()` の本番接続

1. `placeBuilding()` を単一トランザクションの RPC へ接続する。
2. `moveBuilding()` を RPC へ接続する。
3. 現在実装済みの配置・移動 UI は変更せず、Service だけを差し替える。
4. 成功レスポンスの building、coinBalance、population、updatedAt を既存 Hook に反映する。
5. `CONFLICT`、`CELL_OCCUPIED`、`INSUFFICIENT_COINS` などではサーバー状態を再取得する。
6. タイムアウトで結果不明の場合は成功を推測せず、同じ `requestId` で再送または街を再取得する。
7. 移動では購入費が引かれないことを契約テストする。
8. 他ユーザーの建物を更新できないことを確認する。

完了条件: 本番データで建物の購入配置と移動ができ、同一 `requestId` の再送で二重購入・二重更新されない。

### Phase 5: Ranking API の本番接続

1. `createSupabaseRankingApi(supabase, options)` を追加する。
2. `getPopulationRanking({ limit, cursor })` を View / RPC へ接続する。
3. Supabaseモードの `createUnavailableSupabaseRankingApi()` を実 Service に置き換える。
4. バックエンドが返した`user_id`と取得済みAuthユーザーIDをServiceで比較し、`isCurrentUser`を付加する。Componentから判定用ユーザーIDは受け取らない。
5. 人口、表示名、ユーザーIDによる安定した並び順と同率順位を検証する。
6. カーソルをフロントエンドで解釈・生成しない。
7. 建物配置後にランキングを再表示または更新すると、変更後人口と順位が返ることを統合テストする。
8. ランキングレスポンスに非公開情報が含まれないことを検証する。

主な変更候補:

- `frontend/src/features/ranking/services/ranking.ts`（新規）
- `frontend/src/features/ranking/services/index.ts`（新規）
- `frontend/src/app/providers/create-api-services.ts`

完了条件: `/ranking` と街画面内ランキングが同じ本番 API を使い、人口変更後の再取得で順位が更新される。

### Phase 6: 追加の街更新 API

`renameBuilding()`、`placeRoadLine()`、`unlockLand()`は実装対象として確定済み。

1. `renameBuilding()` の `custom_name` と所有権検証を持つ RPC へ接続する。
2. `placeRoadLine()` の全道路セルを単一トランザクション・単一 `requestId` で処理する RPC へ接続する。
3. `unlockLand()`を`{ x, y, requestId }`の座標ベース契約で接続する。
4. スコープ外の操作はSupabaseモードで表示しない。
5. モックと本番の公開 interface を一致させる。

### Phase 7: 歩数表示と既存 Auth / Health の本番確認

1. 旧`useDailyStepsSummary()` / `getDailySteps()`依存を廃止し、歩数取得・報酬精算を`syncSteps()`へ統合する。
2. 初期表示は未同期状態とし、同期成功後に歩数と残高を同時反映する。
3. OAuth callback と許可 Redirect URL をステージング・本番で確認する。
4. 次の既定 Edge Function 名をデプロイ名と照合する。
   - `get-google-integration-state`
   - `begin-google-health-auth`
   - `disconnect-google-health`
   - `sync-health-steps`
5. Edge Function の非2xx応答から安定した `ApiErrorCode` を復元する。
6. ログや画面に token、内部 stack、SQL、生レスポンスを出さない。

### Phase 8: テスト、ステージング確認、リリース

#### 自動テスト

1. Supabase Town / Ranking Service の単体テスト
2. 実 fixture を使用した runtime validator の契約テスト
3. 正しい物理名と引数を呼ぶことのテスト
4. userId、coins、population、価格など、JWT・サーバーから決める値を更新リクエストへ送らないことのテスト
5. Providerのモード切替テスト
   - mockモードは共有Storeを使う
   - supabaseモードは全ServiceがSupabase実装になる
6. 読込、空、再試行、認証切れ、404、競合、不正レスポンスのテスト
7. 更新中の二重送信防止と `requestId` 再送のテスト
8. 公開街は編集不可で、非公開項目を表示しないことのテスト
9. 人口変更後のランキング再取得テスト
10. `npm test`、`npm run lint`、`npm run build`

#### ステージング統合テスト

1. 新規ログインで profile と town が一度だけ作成される。
2. リロード後にセッションと自分の街が復元される。
3. 街、カタログ、ランキングが実データで表示される。
4. 他ユーザーの街を `/town/:userId` で閲覧できる。
5. 公開レスポンスに coins、email、歩数、Health 情報が含まれない。
6. 歩数同期の再実行でコインが二重付与されない。
7. 建物配置と移動ができる。
8. 建物配置で人口が変化した後、ランキング再取得で人口と順位が更新される。
9. コイン不足、範囲外、衝突、競合、存在なしをUIで処理できる。
10. 期限切れセッションから再ログインへ誘導できる。

#### リリース設定

1. 本番の `VITE_API_MODE=supabase`、Supabase URL、publishable key を設定する。
2. Supabase Auth の Site URL と Redirect URL を本番 URL に設定する。
3. Edge Function / RPC / View / RLS のデプロイ版とフロントエンドの契約版を記録する。
4. 最小権限の公開キーで smoke test を行う。
5. 本番実行経路に mock Service が入らないことを確認する。

## 8. 推奨実装順序と優先度

| 優先度 | 実装 | 理由 |
|---|---|---|
| P0 | Phase 0 契約確定 | 物理名、code、未確定操作を推測すると手戻りが発生する |
| P0 | Phase 1 通信基盤・本番fail-closed | 不正レスポンスとモック誤起動を先に防ぐ |
| P0 | Phase 2 `getBuildingCatalog()` / `getMyTown()` | トップ画面表示に両方必要 |
| P1 | Phase 2 `getPublicTown()` | 公開街を本番化する |
| P1 | Phase 3 カタログ表示統一 | 価格と効果のハードコードを解消する |
| P1 | Phase 4 `placeBuilding()` / `moveBuilding()` | 実装済み街編集UIを本番へ接続する |
| P1 | Phase 5 `getPopulationRanking()` | 人口変動を実ランキングへ反映する |
| P1 | Phase 7 日次歩数のタイムゾーン統一 | Dashboardなしで暫定処理を解消する |
| P2 | Phase 6 `renameBuilding()` | バックエンド RPC の準備後に接続する（列は追加済み） |
| P2 | Phase 6 `placeRoadLine()` | 実装対象として確定済み。バックエンド RPC の準備後に接続する |
| P2 | Phase 6 `unlockLand()` | 20×20・1000コインの採用済み契約でバックエンドRPCへ接続する |

`getDashboard()` は優先度表に含めず、実装しない。

## 9. 完了条件

- `getDashboard()` や `DashboardApi` を追加していない。
- 関連文書から `getDashboard()` をフロントエンド必須 API とする記述が整理されている。
- Supabaseモードで `/`、`/town/:userId`、`/ranking` が実データを表示する。
- `createUnavailableSupabaseTownApi()` と `createUnavailableSupabaseRankingApi()` が実 Service に置き換わっている。
- Page / Component が mock 実装を直接 import していない状態を維持している。
- マーケットの価格、サイズ、効果、有効状態が API カタログを正としている。
- `placeBuilding()` と `moveBuilding()` が本番 RPC に接続されている。
- 建物配置後のランキング再取得で、最新人口と順位が返る。
- 公開街とランキングに coins、email、歩数、Health 情報が含まれない。
- 日次歩数表示と歩数同期の日付境界が `Asia/Tokyo` に統一されている。
- 本番設定漏れで mock モードへ暗黙フォールバックしない。
- Supabase Service の契約テスト、既存テスト、lint、build が成功する。
- ステージングで認証、街表示、公開閲覧、ランキング、歩数同期、建物配置、建物移動の smoke test が完了している。

## 10. 現時点のブロッカーと先行可能作業

### ブロッカー

バックエンドの migration、RPC、View、Edge Function 実装または正確な API fixture がこのリポジトリにないため、Town / Ranking Service の物理呼び出しは確定できない。

### 契約共有前に先行できる作業

1. 本番時の `VITE_API_MODE` fail-closed 化
2. 共通エラー変換と validator の骨組み
3. `useDailyStepsSummary()` の `Asia/Tokyo` 統一
4. API カタログからマーケット表示モデルを生成するリファクタリング
5. 未確定機能をSupabaseモードで非表示にする仕組み
6. `getDashboard()` を使用しない方針の文書反映

Town / Ranking の実 Service 実装は、バックエンド担当から第5章の契約が共有された後に開始する。
