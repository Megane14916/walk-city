# Walk City Supabase バックエンド実装計画書

| 項目 | 内容 |
|---|---|
| 調査日 | 2026-08-29 |
| 調査対象 | `main` / `2b98dc2` |
| 対象範囲 | `supabase/migrations`、`supabase/functions`、`supabase/tests`、フロントエンドの Supabase Service |
| 契約の正 | `docs/本番Supabase接続Phase0契約決定書.md` |
| 目的 | 本番接続に必要な Edge Function、公開 RPC、内部 DB Function と前提 DB 実装を確定する |

## 1. 結論

現状は、川・橋を含む街更新 RPC の一部と歩数取得の試作が存在するが、Phase 0 契約を満たす本番バックエンドとしては未完成である。

バックエンド側で必要な実装は次のとおり。

| 区分 | 物理名 | 現状 | 対応 |
|---|---|---|---|
| Edge Function | `initialize-user` | 試作実装済み | RPC呼出名、Auth callback導線、原子性を契約へ合わせる |
| Edge Function | `sync-health-steps` | 試作実装済み | token保管、dailyRollUp parser、RPC呼出、報酬式を改修し既存処理を統合 |
| 公開 RPC | `place_building` | 実装済み | Phase 0 の envelope、エラー、人口再計算へ改修 |
| 公開 RPC | `move_building` | 実装済み | Phase 0 の envelope、エラー、人口再計算へ改修 |
| 公開 RPC | `place_road_line` | 実装済み | Phase 0 の envelopeと通常道路の原子性へ改修。橋拡張は維持 |
| 公開 RPC | `unlock_land` | 未実装 | 新規実装 |
| 公開 RPC | `delete_road` | 実装済み | 現行フロント・川橋仕様の追加契約として維持し、envelopeを統一 |
| 公開 RPC | `rename_building` | 未実装 | [建物詳細・表示名変更API設計書.md](./建物詳細・表示名変更API設計書.md)の契約で新規実装 |
| 内部 DB Function | `private.initialize_user` | 試作実装済み | 初期残高・台帳の一貫性と到達可能な安全な呼出経路を改修 |
| 内部 DB Function | `public.sync_step_rewards` | 実装済み | 10歩1コインの式、戻り値、冪等性を改修。`service_role` のみ実行可 |
| 内部 DB Function | `private.recalculate_town_population` | 未実装 | 人口計算を一か所へ集約して新規実装 |

また、RPC/EFを接続する前提として、次の4 View、カタログデータ、RLSの実装が必須である。

- `building_catalog_view`
- `my_town_details_view`
- `public_town_details_view`
- `population_ranking_view`

`rename_building` は Phase 0 契約の改訂により実装対象へ変更された。プロフィール表示名・街名の変更API/UIはMVP対象外である。`getDashboard()` は Phase 0 契約どおり実装しない。

## 2. 現在のコード調査結果

### 2.1 Migration / DB

| 実装 | ファイル | 判定 |
|---|---|---|
| 基本9テーブル | `20260828102117_remote_schema.sql` | 存在するが、初期化処理、View、実用RLS Policyが不足 |
| 歩数差分精算 | `20260828220500_health_steps_fetch.sql` | 基本差分は実装済み。ボーナスと設定契約が不足 |
| 建物配置・移動・道路/橋配置・道路/橋削除 | `20260829000000_phase4_river_bridges.sql` | 主処理と冪等性テーブルは存在。戻り値と一部ルールが Phase 0 不一致 |
| ユーザー初期化 | `20260829010000_initialize_user.sql` | 試作実装あり。既存town補完時の残高・台帳整合とEFからの呼出経路が不足 |
| 土地開放 | なし | 未実装 |
| 読み取り View | `public_towns` のみ | フロントが使用する4 Viewはすべて未実装 |
| DBテスト | `river_bridges.test.sql` | 川・橋中心の47件のみ。Phase 0 全体のテストが不足 |

### 2.2 Edge Function

| 現在の関数 | 状態 | 問題 |
|---|---|---|
| `google_health_fetch` | 試作あり | ブラウザから呼べる構成、生データと`userId`を返す、内部エラーをmessageへ露出、契約外エラーコードを使用 |
| `health_steps_fetch` | 試作あり | 正式名が違う、期間とtimezoneを入力として受ける、`{ status }`形式、Phase 0 の `StepSyncStatus` を返さない |
| `sync-health-steps` | 試作あり | 平文token依存、dailyRollUpレスポンス解析、RPC呼出名、同時実行時の戻り値が契約不一致 |
| `test_function` | テンプレート | 本番不要。`verify_jwt = false` のためデプロイ対象から除外する |
| `initialize-user` | 試作あり | Auth callbackからの呼出導線がなく、schema付きRPC名も到達できない |

### 2.3 フロントエンドが現在要求している物理API

フロントの Supabase Service は、4 View、`place_building`、`move_building`、`place_road_line`、`delete_road`、`unlock_land`、`sync-health-steps` を既に呼ぶ構造になっている。

一方、Google連携Serviceは次の分離型 Edge Function も呼ぶ。

- `get-google-integration-state`
- `begin-google-health-auth`
- `disconnect-google-health`

GoogleログインとHealth追加認可は分離する。上記3関数に`google-health-callback`を加えたOAuth・接続管理EFは維持し、表示専用`get-daily-steps`は実装しない。歩数取得と報酬精算は`sync-health-steps`へ統合する。

## 3. 発見した矛盾と採用方針

### 3.1 Phase 0 を優先して即決できる項目

| 矛盾 | 現行コード | 採用方針 |
|---|---|---|
| 建物code | seed/testは`house-small`等 | `small_house`、`small_park`、`commercial`、`town_hall`へ移行 |
| 建物名変更 | `custom_name`列が後続migrationで追加済み | APIを実装する。`rename_building` RPCを追加し、View/RPCの`customName`は実値を返す |
| RPCレスポンス | 裸のJSONを返す | `{ ok: true, data }` / `{ ok: false, error }`へ統一 |
| 歩数同期名 | `health_steps_fetch` | 公開名を`sync-health-steps`に統一 |
| 歩数同期入力 | 日付範囲・timezoneを受ける | 公開入力は空オブジェクト。本人、対象日、`Asia/Tokyo`をサーバーで決定 |
| 初期残高 | 現在0 | 新規ユーザーへ1000コインを台帳と同一トランザクションで付与 |
| 土地開放 | 未実装 | 20×20、1000コイン、上下左右隣接で実装 |
| ランキング順位 | Viewなし | `rank() over (order by population desc)`で同率順位を作り、表示順は`population desc, display_name asc, user_id asc` |

旧codeが本番データに存在する場合は、参照中の `placed_buildings` と `building_effects` を先に新codeへ更新してから旧カタログ行を削除する。seedだけを変更して既存データを残さない。

### 3.2 実装前に契約書を補正する必要がある項目

#### Google Health endpoint

Phase 0 の `https://health.googleapis.com/v1/steps` と、現行コードのv4 endpointが不一致である。2026-08-29時点のGoogle公式仕様は、歩数の日次集計に次を案内している。

```text
POST https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp
```

scopeはPhase 0記載の次の値で一致している。

```text
https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
```

これは設計文書同士の好みではなく外部APIの実在性に関わるため、実装では公式v4を採用し、その前に Phase 0 のendpoint記述を更新する。現在の `google_health_fetch` はv4 URLを使っているが、レスポンスの配列名・歩数フィールドを公式fixtureに合わせて再実装する。

#### ユーザー別 refresh token の保管

Phase 0 の「refresh tokenをEF Secretsで扱う」は、ユーザーごとに異なる動的tokenを静的な環境Secretだけへ保存することができないため、そのままでは実装不能である。

採用案は次のとおり。

- 暗号鍵だけを Edge Function Secret に保存する。
- ユーザー別refresh tokenはData API非公開の`private` schemaへ暗号化して保存する。
- `anon` / `authenticated` からschema、table、functionの全権限を剥奪する。
- access tokenはメモリ上だけで使用し、レスポンス・ログ・通常テーブルへ保存しない。
- `public.health_connections`にはtokenを置かず、接続状態、scope、接続日時、最終同期日時だけを保持する。

この保管方式を Phase 0 に追記してから OAuth 実装へ進む。

#### RPC envelope とHTTP status

PostgRESTのDB RPCは、期待されるゲームエラーをJSON envelopeとして返す場合、通常はHTTP 200になる。SQL exceptionでHTTPエラーにすると、レスポンスはPhase 0の独自envelopeにならない。

本計画では、より強い共通契約であるJSON envelopeを優先する。

- 認証済みの期待可能なドメインエラー: HTTP 200 + `{ ok: false, error }`
- JWT不正、権限不足、DB障害などRPC外側の失敗:非2xx。フロントServiceが`ApiResult`へ正規化
- HTTP statusも厳密に統一する必要が生じた場合は、更新APIをEdge Functionで包む別Phaseとする

#### `security_invoker` View と「公開Viewだけ」の両立（確定）

`security_invoker = true` のViewは呼出ユーザーの基礎テーブル権限とRLSを使う。公開街を読ませるために基礎行の公開列へ権限を与えると、その公開列は直接Queryも可能になる。

`security_invoker = true` を継続することを確定する。公開用SECURITY DEFINER関数への切り替えは行わない。

- `coins`、歩数、Health、台帳は列権限とRLSの両方で非公開にする。
- 公開街用の列だけを認証ユーザーへ読取可能にする。
- フロントの正式経路は`public_town_details_view`に限定するが、認証ユーザーが基礎テーブルの公開列を直接Queryできてしまうこと自体は許容する（非公開列は列権限とRLSで到達できないため、情報漏えいは発生しない）。
- コンポーネント・モックはViewだけを経由し、直接Queryへの依存を作らない運用で秘匿性を担保する。

## 4. Edge Function 実装仕様

### 4.1 `initialize-user`

#### 責務

1. JWTを検証し、`auth.uid()`相当の本人IDを取得する。
2. `private.initialize_user`をservice roleで1回呼ぶ。
3. profile、town、初期開放、初期台帳の作成結果をenvelopeで返す。
4. 同じユーザーから何度呼ばれても二重作成・二重付与しない。

#### 起動契約

現行フロントのGoogle OAuth導線に合わせ、`/auth/callback`でセッション復元後、`/health/connect`へ遷移する前に空bodyで呼ぶ。新規登録と再ログインの判定はフロントで行わず、既存ユーザーへの呼び出しを冪等に処理する。初期化失敗時は遷移せず、コールバック画面から再試行できるようにする。

#### DB内の原子的処理

- `profiles`: 認証ユーザーUUIDからハイフンを除いた先頭8文字による`user-xxxxxxxx`
- `towns`: 同じUUID先頭8文字による`Town-xxxxxxxx`、100×100、初期1000コイン
- `unlocked_areas`: `(40,40,20,20)`、`unlock_method = 'initial'`
- `coin_ledger`: `amount = 1000`、`reason = 'initial_grant'`、`idempotency_key = 'initial_grant:<userId>'`

EFから4テーブルへ順にinsertしてはいけない。途中失敗を残さないため、DB Function内の1トランザクションで実行する。

新規登録と再ログインの両方で同じ処理を呼び、`initialize-user`導入前から存在するAuthユーザーは次回ログイン時に不足データだけを遅延作成する。全件backfill migrationは作成せず、既存行・残高・初期付与台帳を上書きまたは二重作成しない。

#### 出力

```json
{
  "ok": true,
  "data": {
    "profileId": "uuid",
    "townId": "uuid",
    "created": true
  }
}
```

`created`は今回不足データを作成した場合に`true`、すでに初期化済みで何も作成しなかった場合に`false`とする。初期化済みユーザーへの再送は同じIDと`created: false`を返す。

### 4.2 `sync-health-steps`

#### 公開契約

- method: `POST`
- JWT: 必須
- body: `{}`のみ。歩数、userId、coin、日付、timezoneを受け取らない
- 日付境界: `Asia/Tokyo`
- 外部API呼出中にDBロックを保持しない

#### 処理順

1. JWTから本人を取得する。
2. 接続状態、必要scope、暗号化refresh tokenを確認する。
3. refresh tokenを復号し、access tokenへ交換する。
4. Google Health v4 `dailyRollUp`で東京時間の当日歩数を取得する。
5. 外部レスポンスをschema validationし、日付と非負整数歩数だけに正規化する。
6. service role限定の`sync_step_rewards`へ正規化済みデータを渡す。
7. `StepSyncStatus`へ変換してenvelopeで返す。

#### 出力

```ts
type StepSyncStatus = {
  date: string
  timezone: 'Asia/Tokyo'
  steps: number
  newlyRewardedSteps: number
  coinsAwarded: number
  coinBalance: number
  appliedBonuses: Array<{
    sourceBuildingType: string
    sourceCount: number
    effectType: string
    amount: number
  }>
  syncedAt: string
}
```

#### エラー

- tokenなし: `HEALTH_NOT_CONNECTED`
- scope不足またはGoogleの`MISSING_OAUTH_SCOPE`: `HEALTH_PERMISSION_REQUIRED`
- 外部timeout、5xx、不正レスポンス: `HEALTH_PROVIDER_ERROR`
- JWTなし: `UNAUTHENTICATED`
- その他: `INTERNAL_ERROR`

Googleの生レスポンス、token、SQLエラー、stackはクライアントにもログにも出さない。ログはrequest correlation ID、HTTP status、内部分類だけを記録する。

### 4.3 既存Edge Functionの扱い

- `google_health_fetch`: ロジックを`sync-health-steps`内の非公開モジュールへ移し、削除または非deploy化する。
- `health_steps_fetch`: `sync-health-steps`へ置換後に削除する。
- `get-daily-steps`: 表示専用EFを廃止し、当日歩数は`sync-health-steps`の成功レスポンスを使用する。
- `test_function`: 本番deploy対象から削除する。少なくとも`verify_jwt = false`のまま残さない。

OAuth開始、callback、接続状態取得、切断は歩数精算と責務が異なるため、`begin-google-health-auth`、`google-health-callback`、`get-google-integration-state`、`disconnect-google-health`として維持する。

## 5. RPC / DB Function 実装仕様

### 5.1 共通方式

すべての公開更新RPCは次を満たす。

- `SECURITY DEFINER`
- `set search_path = ''`
- `auth.uid()`からユーザーを決定
- `PUBLIC`、`anon`のexecuteをrevokeし、`authenticated`だけgrant
- requestIdはUUID、同一入力の再送は同一envelopeを返す
- 同じrequestIdで異なる入力は`CONFLICT`
- client入力の価格、サイズ、owner、town、coins、populationを無視する
- 期待されるエラーは共通の日本語messageとコードを持つenvelopeへ変換
- idempotency保存には成功envelope全体を保存する

`private.raise_api_error`、`private.lock_rpc_request`、`private.save_rpc_request`は流用し、公開wrapperで例外コードを安全なenvelopeへ変換する。

### 5.2 `place_building`

現行の所有権、カタログ、境界、開放、衝突、川、道路、残高検証は流用する。

改修点:

- 通常建物用RPCとして道路カテゴリを拒否し、道路は`place_road_line`へ限定する。
- 人口の加算更新ではなく`private.recalculate_town_population(town_id)`で全体再計算する。
- Phase 0の正式codeと効果データを参照する。
- 成功結果を`{ ok: true, data: TownMutationResult }`で返す。
- 失敗時は配置、残高、台帳、人口をすべてrollbackする。

### 5.3 `move_building`

現行の所有権、境界、開放、衝突、川、道路条件、道路/橋移動禁止を維持する。

改修点:

- 移動後に共通人口再計算関数を呼ぶ。
- コインと`coin_ledger`は変更しない。
- 成功・エラーenvelopeを統一する。

### 5.4 `place_road_line`

現行の川・橋判定は後続の確定仕様として維持する。

改修点:

- 通常道路で既存道路と重なるセルは新規配置せず、課金対象からも除外する。
- 入力線の新規道路セルだけを抽出し、その配置・台帳・残高更新を一つのトランザクションで行う。
- 1〜100セル、重複なし、縦横いずれかの連続直線を検証する。
- `private.recalculate_town_population`を呼び、成功envelopeを保存・返却する。
- 橋の場合は現行どおり陸1+川5+陸1、直交、曲がり角不可、7セル一括とする。

### 5.5 `unlock_land`

引数:

```sql
unlock_land(p_x integer, p_y integer, p_request_id uuid)
```

処理:

1. 本人のtownを`FOR UPDATE`でロックする。
2. `x`、`y`が20の倍数で、20×20が100×100内に収まることを確認する。
3. 同じ領域が未開放であることを確認する。
4. 既存領域と上下左右の辺で接することを確認する。斜め接触は拒否する。
5. 残高1000以上を確認する。
6. `unlocked_areas`追加、`coin_ledger`へ`land_unlock` -1000、残高減算、`updated_at`更新を一括実行する。
7. `UnlockLandResult`をenvelopeで返す。

エラーは`OUT_OF_MAP`、`AREA_ALREADY_UNLOCKED`、`AREA_NOT_ADJACENT`、`INSUFFICIENT_COINS`、`CONFLICT`を使う。

### 5.6 `delete_road`

Phase 0当初の一覧にはないが、現行フロントと最新バックエンド設計が使用し、実装・DBテストも存在するため削除しない。

- 通常道路1セル、橋7セル+構造行を一括削除
- 返金なし
- 道路条件を壊す場合は`ROAD_IN_USE`
- 冪等性、envelope、権限方式を他RPCと統一

### 5.7 内部人口再計算

`private.recalculate_town_population(p_town_id uuid)`へ集約する。

- `population_flat`だけを対象に配置数×効果値を集計する。
- `small_house +10`、`apartment +50`、`farm +20`と、公園・病院・役所の条件付き人口効果を設定データから計算する。
- 未知のeffect typeを暗黙実行しない。
- `place_building`、`move_building`、`place_road_line`から呼ぶ。

### 5.8 内部歩数精算

`sync_step_rewards`はservice roleだけが実行できる内部RPCとして維持する。

改修点:

- 基本報酬は10歩につき1コイン、端数切り捨て、日次上限なしとする。
- `daily_step_records`の`(user_id, step_date, source)`一意制約を使う。
- 今回付与額は`max(0, floor(total_steps / 10) - floor(previous_rewarded_steps / 10))`とし、同日の分割同期で10歩未満の端数を失わない。
- 商業施設・工場のボーナスを、合計最大50%で基本付与額に適用する。
- 基本報酬とtown残高を同一トランザクションで更新する。
- 結果に`newlyRewardedSteps`と`appliedBonuses`を含める。後者は商業施設・工場のボーナス内訳を返し、ボーナスなしの場合は空配列とする。

### 5.9 `rename_building`

[建物詳細・表示名変更API設計書.md](./建物詳細・表示名変更API設計書.md) §5の契約をそのまま採用する新規RPC。

引数:

```sql
rename_building(p_building_id uuid, p_custom_name text)
```

処理:

1. JWTから認証ユーザーを特定する。
2. `building_id`を検証し、対象建物と所属する街をロックして取得する。
3. 認証ユーザーが街の所有者であることを確認する（`NOT_OWNER`）。
4. `p_custom_name`が文字列の場合、前後空白を除去し1〜30 Unicodeコードポイント・制御文字なしを検証する（`INVALID_INPUT`）。
5. カタログ初期名と同じ、または`p_custom_name`が`null`の場合は`custom_name = NULL`にする。
6. `custom_name`と`placed_buildings.updated_at`だけを更新する。
7. 更新後の`PlacedBuilding`を返す。

コイン残高、人口、コイン台帳、建物種類、配置座標、建物効果、作成日時は変更しない。同じ値を設定する操作のため、専用の`requestId`と冪等性台帳は追加しない。

## 6. View、RLS、カタログの前提実装

### 6.1 View

#### `building_catalog_view`

- `building_types`と`building_effects`を結合する。
- effectsは常にJSON配列。0件は`[]`。
- `building_effects`に表示用`description`列を置かず、Viewは効果の構造化データだけを返す。既知の説明文はフロントエンドServiceで生成する。
- code昇順で安定取得できる。

#### `my_town_details_view`

- `owner_id = auth.uid()`の1行だけ。
- coinsを含む。
- buildings、unlocked_areasをJSON集約する。
- `custom_name`の実値を`customName`として返す。
- 有効カタログの最大`catalog_version`を返す。

#### `public_town_details_view`

- userId、displayName、town公開項目、buildings、unlockedAreasだけを返す。
- coins、email、歩数、Health、台帳を列定義に含めない。
- `custom_name`の実値を`customName`として返す（公開情報として扱う。[建物詳細・表示名変更API設計書.md](./建物詳細・表示名変更API設計書.md) §3.3）。

#### `population_ranking_view`

- 順位は人口だけで`rank()`を計算する。
- 同率内の表示順はdisplay_name、user_id。
- `is_current_user`は返さない。フロントエンドServiceが`user_id`と取得済みAuthユーザーIDを比較して`isCurrentUser`を付加する。
- coins等の非公開列を含めない。

### 6.2 RLS / GRANT

- profiles: 認証ユーザーが公開列を読め、本人だけdisplay_nameを更新できる。
- towns: 本人は自分の全必要列、他人は公開列だけ。
- placed_buildings / unlocked_areas / road_structures: 読み取り公開範囲を明示し、書込みはRPCだけ。
- daily_step_records / health_connections / coin_ledger: 本人だけ読み取り。書込みはEF/RPCだけ。
- town_rpc_requestsとprivate schema:クライアントから完全に不可視。
- 全ゲームテーブルの`insert/update/delete`を`anon` / `authenticated`からrevokeする。

現在の`towns_read_authenticated using (true)`、`placed_buildings_read_authenticated using (true)`等は範囲が広いため、列GRANTを含めて見直す。

### 6.3 カタログ

Phase 0の9商品へseedを修正する。

| code | cost | 主要効果 |
|---|---:|---|
| `small_house` | 50 | `population_flat +10` |
| `apartment` | 200 | `population_flat +50` |
| `small_park` | 150 | 隣接する住宅（小）ごとに人口 +5、住宅（大）ごとに人口 +10（最大+40） |
| `hospital` | 600 | 町内の住宅（小）ごとに人口 +5、住宅（大）ごとに人口 +10（配置順不問） |
| `commercial` | 300 | 歩数コイン +10%（最大3軒） |
| `farm` | 100 | `population_flat +20` |
| `road` | 0 | 隣接土地へ建物を配置可能（強制はマップルール） |
| `town_hall` | 3000 | 町内の住宅（小）ごとに人口 +20、住宅（大）ごとに人口 +30（1軒分のみ、配置順不問） |
| `factory` | 700 | 歩数コイン +25%（最大2軒） |

## 7. 実装フェーズと順序

### Phase A: 契約補正とDB土台（最優先）

1. Phase 0のGoogle endpoint、token保管方式、RPC error transportを追記する。
2. 正式codeへのデータmigrationとseed修正を行う。`map_layouts.id`と参照列は`text`・初期値`walk-city-v1`へ統一し、`building_effects.description`は廃止する。
3. 初期化・人口再計算のprivate functionを追加する。
4. 4 View、RLS、GRANTを追加する。
5. DB resetがseedまで通ることを確認する。

完了条件: 新規DBをmigration+seedだけで再現でき、4 Viewを契約どおり読める。

### Phase B: 街更新RPC

1. 共通envelope、エラーマッピング、冪等性helperを整備する。
2. `place_building`を改修する。
3. `move_building`を改修する。
4. `place_road_line`を改修する。
5. `unlock_land`を新規実装する。
6. `delete_road`を共通契約へ合わせる。
7. `rename_building`を新規実装する。

完了条件: 各操作の成功、失敗、再送、同時実行で部分更新と二重消費がない。

### Phase C: ユーザー初期化

1. `private.initialize_user`を実装する。
2. `initialize-user` EFを実装する。
3. Auth callback後に呼ばれるフロント導線と結合する。

完了条件: 新規ログイン1回で街が利用可能になり、再試行しても残高は1000のまま。

### Phase D: Google Health / 歩数精算

1. OAuth token保管と更新処理を実装する。
2. Google公式fixtureによるv4 client単体テストを作る。
3. `sync_step_rewards`を改修する。
4. `sync-health-steps`を実装する。
5. 既存試作EFを内部化・削除する。

完了条件: 10歩につき1コインが端数切り捨て・上限なしで付与され、同じ歩数の再同期は0、分割同期でも端数を失わない。

### Phase E: 統合・デプロイ

1. ローカルDBテスト、Edge Functionテスト、フロント契約テストを通す。
2. stagingへmigration→seed/管理データ→EFの順でdeployする。
3. Google OAuth redirect URL、scope、Secretsを設定する。
4. 2ユーザーで本人街、公開街、ランキング、RLS漏えいを確認する。
5. 障害時のrollback手順を確認後、本番へ適用する。

## 8. テスト計画

### 8.1 DB / pgTAP

- 新規ユーザー初期化と再送で、profile/town/area/ledgerが各1件。
- 他ユーザーの残高、歩数、Health、台帳を読めない。
- 4 Viewの列、0件配列、公開/非公開項目。
- 建物1×1/2×2の境界、未開放、衝突、川、道路、残高不足。
- 同時購入で残高が負にならない。
- 全更新RPCの同一requestId再送と異入力`CONFLICT`。
- 通常道路の一部占有で全体rollback。
- 土地開放の20倍数、境界、重複、辺隣接、斜め拒否、残高、再送。
- 人口が`small_house`、`apartment`、`farm`だけから正しく再計算される。
- ランキングが同率1,2,2,4となり、同率内で安定順になる。
- 歩数減少時に報酬を取り消さず、増分だけを次回精算する。
- 商業施設は最大3軒、工場は最大2軒、合計最大50%のコインボーナスになる。

### 8.2 Edge Function

- JWTなし、method不正、JSON不正。
- tokenなし、scope不足、refresh失敗、Google 429/5xx/timeout、不正JSON。
- Googleの生エラーやtokenがレスポンス・logへ出ない。
- 東京時間の日付境界前後。
- 初期化EFの並列呼出と再試行。
- `sync-health-steps`の公開bodyが空であること。

### 8.3 結合

- フロントのruntime validatorが全View/RPC/EFレスポンスを受理する。
- 配置後の人口とランキング人口が一致する。
- 公開街にcoins等が存在しない。
- タイムアウト後の同じrequestId再送でUIとDBが一致する。

## 9. 決定ゲート

次の1点だけは、該当Phase開始前に明文化が必要である。

| 決定 | 期限 | 未決定時の影響 |
|---|---|---|
| Google OAuth code/refresh tokenをEFへ渡す具体フロー | Phase D前 | 一体型ログインだけではサーバー側token保管を完了できない |

`security_invoker` Viewの継続は確定済み（§3.2）。公開用SECURITY DEFINER関数への切り替えは行わない。

その他は Phase 0 の仮決定を使って実装を開始できる。

## 10. 推奨ファイル構成

```text
supabase/
  functions/
    _shared/
      api-response.ts
      google-health-client.ts
      token-store.ts
    initialize-user/
      index.ts
      deno.json
    sync-health-steps/
      index.ts
      deno.json
  migrations/
    <timestamp>_phase0_contract_alignment.sql
    <timestamp>_phase0_views_rls_catalog.sql
    <timestamp>_phase0_rpc_envelopes.sql
    <timestamp>_phase0_unlock_land.sql
    <timestamp>_phase0_user_initialization.sql
    <timestamp>_phase0_step_rewards.sql
  tests/
    database/
      phase0_views_rls.test.sql
      town_mutations.test.sql
      unlock_land.test.sql
      user_initialization.test.sql
      step_rewards.test.sql
```

既存migrationを書き換えず、追加migrationで差分を適用する。本番適用済みの可能性がある履歴を破壊しないためである。

## 11. 完了条件

- `supabase db reset`が成功し、seedを含めて再現可能。
- 必須4 View、Phase 0の公開4 RPC、追加契約の`delete_road`と`rename_building`、公開2 EFが物理名どおり存在する。
- 全RPC/EFが共通envelopeを返す。
- JWTとRLSにより他人の非公開データへ到達できない。
- 初期1000コイン、購入、土地開放、歩数報酬が必ず台帳と残高で一致する。
- 全更新が冪等で、失敗時に部分更新を残さない。
- 正式建物codeだけで新規データが作られる。
- Google Healthの公式v4 fixtureと実stagingアカウントで当日歩数を取得できる。
- フロントのSupabaseモードでログイン、街表示、配置、移動、道路/橋、土地開放、歩数同期、ランキング、公開街が一巡する。

## 12. 参照

- `docs/本番Supabase接続Phase0契約決定書.md`
- `docs/バックエンド.md`
- `docs/川・橋機能DesignDoc.md`
- `frontend/src/features/town/services/town.ts`
- `frontend/src/features/ranking/services/ranking.ts`
- `frontend/src/features/health/services/step-sync.ts`
- Google Health API Endpoints: <https://developers.google.com/health/endpoints>
- Google Health API Steps: <https://developers.google.com/health/data-types/steps>
