# Walk City Supabase バックエンド仕様矛盾点一覧（再整理版）

| 項目 | 内容 |
|---|---|
| 更新日 | 2026-08-29 |
| 調査基準 | `main` / `1a4f084` |
| 対象 | `docs`、`supabase`、フロントエンドのSupabase API境界 |
| 目的 | 実装修正前に、残っている仕様矛盾と単なる実装未追従を分離し、必要な判断だけを依頼できる状態にする |
| 正本 | 今回の調査では、ユーザー指示に従い[本番Supabase接続Phase0契約決定書](./本番Supabase接続Phase0契約決定書.md)を優先する |

## 1. 今回の再調査結果

コミット`1a4f084`では11文書が更新され、次の方針が関連文書へ反映された。

- GoogleログインとGoogle Health追加認可を分離する。
- Google Healthはv4 `dailyRollUp`を使用する。
- refresh tokenは暗号化して`private.health_tokens`へ保存し、暗号鍵だけをEF Secretsへ置く。
- `getDashboard()`と`/users/:userId`は実装しない。
- `renameBuilding()`と`placeRoadLine()`は実装する。
- 人口効果は住宅（小）+10、住宅（大）+50だけとする。
- 工場、農場、役所に効果を持たせない。
- 暫定価格、RPCエラー時のHTTP 200、土地開放の座標入力、道路の4方向隣接、`security_invoker` Viewを採用する。

その後のユーザー回答により、`DEC-01`から`DEC-14`までの全14件を確定した。未決定項目はない。

更新後に残る不一致は次の3種類に分ける。

| 区分 | 意味 |
|---|---|
| `要判断` | 正本だけでは一意に決められない、または今回のユーザー決定と文書が衝突している |
| `文書未追従` | 方針は既に決まっているため再判断は不要だが、古い文書が残っている |
| `実装未追従` | 文書の採用方針は明確だが、`supabase`またはフロントエンドがまだ一致していない |

## 2. 今回解消された項目と残課題

| 項目 | 今回の統一結果 | 再調査結果 |
|---|---|---|
| GoogleログインとHealth同意 | ログイン後の別操作 | 文書上は解消。OAuth用EFは未実装 |
| Health endpoint | v4 `dailyRollUp` | 文書上は解消。現行`sync-health-steps`のレスポンス解析が契約と不一致 |
| refresh token | `private.health_tokens`へ暗号化保存 | 文書上は解消。現行DB/EFは`public.health_connections.refresh_token`を平文で使用 |
| Dashboard | 専用`getDashboard()`を作らない | 解消。既存APIの組合せを使用 |
| ユーザーページ | `/users/:userId`を実装しない | 他文書と現行フロントが未追従（`DOC-02`） |
| 建物名変更 | `rename_building`を実装 | 文書上は解消。RPCは未実装 |
| 道路一括配置 | `place_road_line`を正式APIとする | 既存の通常道路との重複セルは新規配置・課金から除外する |
| 建物効果 | 画像指定の公園・病院・商業施設・農場・道路・役所・工場効果を採用 | 2026-08-30に旧決定を改定。詳細は「建物効果仕様」 |
| 工場 | 歩数コイン +25%（最大2軒、商業施設と合計50%まで） | 2026-08-30に旧の「効果なし」を改定 |
| カタログ価格・enabled | Phase 0の値を暫定採用 | 暫定値として整合。seedのcodeは未追従 |
| RPCドメインエラー | HTTP 200 + `{ok:false,error}` | 文書上は解消。現行RPCはSQL exceptionを使用 |
| 土地開放 | `{x,y,requestId}`で今回実装 | 文書上は解消。現行RPCは未実装（`DEC-07`） |
| 道路隣接 | 上下左右4方向、斜め不可 | `building_effects`ではなくマップルールとして整理済み |
| 読み取りView | `security_invoker = true`を継続 | 文書上は解消。4 View、列権限、RLSは未実装 |

## 3. 仕様決定項目

### `DEC-01` 建物効果の対象

2026-08-30改定: 住宅2種だけでなく、公園・病院・商業施設・農場・道路・役所・工場にも効果を持たせる。旧決定`B`は廃止し、[建物効果仕様.md](./建物効果仕様.md) を正本とする。道路の効果はカタログに表示し、配置可否の強制は引き続きマップルールで行う。

ステータス: `ユーザー確定`

### `DEC-02` 効果説明文の保存場所

| 情報源 | 仕様 |
|---|---|
| Phase 0 §6.1 | `building_effects`に表示用description列を置かず、Serviceで説明文を生成 |
| 現行migration・seed | `building_effects.description`へ説明文を保存 |
| フロントエンド設計 | APIから人間向けdescriptionを受け取れる形が望ましい |

建物効果の説明文をDBで管理するかServiceで生成するかは、効果の対象数にかかわらず統一する必要がある。

決定: `A`。`building_effects`に表示用`description`列を置かず、既知の効果説明はフロントエンドServiceで生成する。未知の効果は空文字列へ変換する。

選択肢:

- `A`: Phase 0どおりServiceで生成し、DBのdescription列を廃止する。
- `B`: DBのdescriptionを正とし、Viewから返す。
- `C`: `building_types.description`だけを表示文として使用する。

ステータス: `ユーザー確定`

### `DEC-03` 新規ユーザー初期化を起動する契機

決定前の[本番Supabase接続Phase0契約決定書](./本番Supabase接続Phase0契約決定書.md)は`initialize-user` Edge Functionを採用していたが、Auth登録後に誰が呼ぶかを定めていなかった。現行コードにはまだ呼び出し経路がないため、実装追従は必要である。

決定: `A`。現行フロントのGoogle OAuthコールバックでセッション復元後、`/health/connect`へ遷移する前に`initialize-user`を空bodyで呼ぶ。新規登録と再ログインをフロントで判別せず、EFを冪等にして新規ユーザーだけに不足データを作成する。

選択肢:

- `A`: Auth callback後にフロントエンドが`initialize-user`を呼ぶ。
- `B`: `auth.users`のAFTER INSERT TriggerでDB初期化を自動実行する。
- `C`: Supabase Auth Hookから初期化処理を起動する。

ステータス: `ユーザー確定`

### `DEC-04` 初期表示名・街名

| 情報源 | 仕様 |
|---|---|
| [バックエンド.md](./バックエンド.md) | ランダム6文字の`user-xxxxxx`、`Town-xxxxxx` |
| 現行`private.initialize_user` | ユーザーUUID先頭8文字の`user-xxxxxxxx`、`Town-xxxxxxxx` |

決定: `B`。認証ユーザーUUIDのハイフンを除去した先頭8文字を使用し、`user-xxxxxxxx`と`Town-xxxxxxxx`を生成する。同じユーザーでは常に同じ初期値になる。

選択肢:

- `A`: ランダム6文字。
- `B`: UUID由来8文字。
- `C`: Googleプロフィール名など別の初期値を指定する。

ステータス: `ユーザー確定`

### `DEC-05` 既存Authユーザーの初期化

`initialize-user`導入前に存在する`auth.users`へprofile/town等を作るbackfill方針がない。起動方式だけ決めても、既存ユーザーは自動的には補完されない可能性がある。

決定: `B`。全件backfill migrationは行わず、次回ログイン時に`initialize-user`が不足データだけを遅延作成する。初期コインを含む既存データは上書き・二重作成しない。

選択肢:

- `A`: migrationで全既存ユーザーを一括backfillする。
- `B`: 次回ログイン時に不足データだけ遅延作成する。
- `C`: 開発データを破棄できる前提で既存ユーザーを対象外とする。

ステータス: `ユーザー確定`

### `DEC-06` プロフィール表示名・街名の変更

`profiles.display_name`と`towns.name`は変更可能と書かれているが、正式なRPC、入力制約、UIスコープが定義されていない。建物名変更の`rename_building`とは別機能である。

決定: `B`。DB列は将来変更できる設計を維持するが、MVPではプロフィール表示名・街名の変更APIとUIを実装しない。建物表示名の`rename_building`は別機能として実装対象に残す。

選択肢:

- `A`: MVPに変更APIを含める。
- `B`: DB列は変更可能な設計のまま、MVPでは変更UI/APIを作らない。

ステータス: `ユーザー確定`

### `DEC-07` 土地開放を今回実装するか

| 情報源 | 仕様 |
|---|---|
| Phase 0 §3.1、§7.4 | `unlock_land`を20×20・1000コインで実装 |
| [API計画書](./API計画書.md) §9（決定前） | `unlockLand`は「予約」、ルール決定後に有効化 |
| [本番Supabase接続実装計画書](./本番Supabase接続実装計画書.md)（決定前） | 実装対象として確定していないため本番で無効化・保留 |
| 現行フロント | 20×20・1000コインのUIを実装済み |
| 現行DB | `unlock_land` RPCなし |

入力形式は座標ベースへ統一済みで、今回の決定により実装スコープも統一した。

決定: `A`。20×20・1000コインのPhase 0契約で今回実装する。

選択肢:

- `A`: Phase 0どおり今回実装する。
- `B`: MVP対象外としてUIを無効化する。
- `C`: 条件を変更して実装する。

ステータス: `ユーザー確定`

### `DEC-08` 川・橋を正式なMVP仕様に含めるか

[川・橋機能DesignDoc](./川・橋機能DesignDoc.md)、API計画書、現行フロント、migrationには固定川、7セル橋、橋価格、道路削除が定義・実装されていた。一方、決定前のPhase 0には橋固有契約が明示されていなかった。

`DEC-01`で道路・橋を基本マップルールとして残す場合でも、MVP正式仕様に含めるかを明記する必要がある。

決定: `A`。固定川、7セル橋、橋価格、道路・橋削除を正式なMVP仕様に含める。

選択肢:

- `A`: 固定川、橋、道路削除を正式採用する。
- `B`: 川の表示だけを残し、橋建設は対象外にする。
- `C`: 川・橋をMVP対象外にする。

ステータス: `ユーザー確定`

### `DEC-09` マップレイアウトIDの型

| 情報源 | 型 |
|---|---|
| `バックエンド.md` §5.6 | `uuid` |
| `川・橋機能DesignDoc`、現行migration、フロント | `text`。初期値`walk-city-v1` |

決定: `A`。`map_layouts.id`、`towns.map_layout_id`、`map_terrain_areas.map_layout_id`は`text`を正式採用し、MVPの初期値を`walk-city-v1`とする。

選択肢:

- `A`: `text`を正式採用する。
- `B`: UUIDへ変更する。

ステータス: `ユーザー確定`

### `DEC-10` 歩数からコインへの変換ルール

決定前は、歩数報酬の基本変換率、端数処理、日次上限が主要文書でTBDだった。現行`sync_step_rewards`は`steps_to_coins_rate`未設定時に0を使用するため、決定済み仕様への実装追従が必要である。

決定が必要な値:

- 何歩で何コインか。
- 端数を切り捨てるか、繰り越すか。
- 日次上限を設けるか、設ける場合はいくらか。

決定: 10歩につき1コイン、端数切り捨て、日次上限なし。同日の分割同期で端数を失わないよう、付与額は`max(0, floor(total_steps / 10) - floor(previous_rewarded_steps / 10))`とする。

ステータス: `ユーザー確定`

### `DEC-11` 歩数表示APIと旧Edge Functionの扱い

公開の報酬同期は`sync-health-steps`・空body・当日東京時間に統一された。一方、次が残っている。

- `Google認証機能DesignDoc`の表示用`getDailySteps({date, timezone})`
- 期間指定を受ける`health_steps_fetch`
- 内部取得候補の`google_health_fetch`
- 当日同期とGoogle取得を一体化した`sync-health-steps`

決定: `A`。歩数取得と精算を`sync-health-steps`へ統合し、`google_health_fetch`、`health_steps_fetch`、表示専用`get-daily-steps`は削除または非deploy化する。OAuth開始、callback、接続状態取得、切断用EFは別責務として残す。

選択肢:

- `A`: `sync-health-steps`へ統合し、旧2関数と過去日表示APIを廃止する。
- `B`: `sync-health-steps`を精算専用とし、表示専用`getDailySteps`だけ残す。旧2関数は非deploy化する。
- `C`: `google_health_fetch`だけ内部専用として残し、ブラウザからの実行権限を与えない。

ステータス: `ユーザー確定`

### `DEC-12` `appliedBonuses`を残すか

2026-08-30改定: 商業施設と工場のコイン効果を採用するため、ボーナスが実際に適用された同期では`appliedBonuses`に内訳を返す。旧決定`A`の「常に空配列」は廃止する。

ステータス: `ユーザー確定`

### `DEC-13` 外部公開するエラーコード集合

Phase 0基本コード、川・橋追加コード、土地開放コード、旧EF独自コード、初期化SQL独自例外が併存している。内部例外名をそのままクライアントへ返すかが統一されていない。

決定: `A`。外部契約はフロント共通`ApiErrorCode`へ統一する。SQL例外名、Googleレスポンス、スタックなどの内部分類は公開せず、ServiceまたはEF境界で共通コードへ正規化する。

選択肢:

- `A`: フロント共通`ApiErrorCode`へ統一し、SQL・Googleの内部分類は外部へ出さない。
- `B`: 必要な独自コードを共通契約へ追加する。

ステータス: `ユーザー確定`

### `DEC-14` ランキングの`isCurrentUser`計算場所

| 情報源 | 仕様 |
|---|---|
| [ランキング機能DesignDoc](./ランキング機能DesignDoc.md) | サーバーがJWTから判定して返す |
| Phase 0 §6.4、現行フロントService | Viewの`user_id`と取得済みAuthユーザーIDをServiceで比較 |

決定: `B`。`population_ranking_view`は`user_id`を返し、フロントエンドServiceが取得済みの認証ユーザーIDと比較して`isCurrentUser`を付加する。ComponentからユーザーIDを入力させない。

選択肢:

- `A`: View/RPCが`is_current_user`を返す。
- `B`: Phase 0どおりフロントServiceで比較する。

ステータス: `ユーザー確定`

## 4. 方針決定済みだが古い文書が残っている項目

以下はPhase 0を正本とする限り再判断不要であり、関連文書を更新すればよい。

### `DOC-01` 正本の優先順位

ユーザー指示はPhase 0契約決定書を優先する一方、Phase 0 §1自身は`バックエンド.md`を最優先とし、`frontend-architecture.md`や各Design Docも別の優先順位を定めている。Phase 0を正本にするなら、同書§1と各文書の優先順位記述を更新する必要がある。

ステータス: `文書未追従`

### `DOC-02` `/users/:userId`を実装しない方針

今回のコミットでは複数文書から`/users/:userId`を削除したが、[ユーザーページDesignDoc](./ユーザーページDesignDoc.md)は全編が実装する仕様のままであり、現行フロントにもルート、コンポーネント、Hook、テストが存在する。

「実装しない」が決定済みなら、Design Docを廃止・履歴化し、フロントの既存実装を残すか削除するかを実装計画へ明記する必要がある。

ステータス: `文書未追従`

### `DOC-03` 初期コイン1000

Phase 0は全初期ユーザーへ1000コインを付与する。`バックエンド.md`にはtown既定値0と「デモユーザーへ1000程度」という旧案が残っているため、一般ユーザーへの初期付与として更新する。

ステータス: `文書未追従`

### `DOC-04` 正式建物code

Phase 0は`small_house`、`small_park`、`commercial`、`town_hall`等のsnake_caseを正式codeとしている。`本番Supabase接続実装計画書`にある旧code対応表は現状調査として残せるが、seed・テストを正式codeへ移行する作業だと明記する必要がある。

ステータス: `文書未追従`

### `DOC-05` ランキング仕様

Phase 0は`RANK()`による`1,2,2,4`、人口降順・表示名昇順・user ID昇順、20件、最大100件、`offset:<n>`を採用している。一方、`API計画書.md`、`バックエンド.md`、`frontend-architecture.md`にはTBDが残る。

ステータス: `文書未追従`

### `DOC-06` 読み取りAPIの物理方式

Phase 0は次の4つの`security_invoker` Viewを通常Queryする方式に確定している。`ランキング機能DesignDoc`の「ViewまたはRPC」は更新が必要である。

- `building_catalog_view`
- `my_town_details_view`
- `public_town_details_view`
- `population_ranking_view`

ステータス: `文書未追従`

### `DOC-07` RPC envelopeとDB境界の命名

Phase 0はRPC/EFが`{ok,data/error}`を返し、DB/View/RPC出力はsnake_case、フロントServiceでcamelCaseへ変換する。旧仕様を許容する記述は移行期間の互換処理だと明記し、正式契約と混在させない。

ステータス: `文書未追従`

### `DOC-08` 匿名アクセス

Phase 0とフロントルート設計は、カタログ、公開街、ランキングを含む初期ゲーム画面をログイン必須としている。匿名公開は将来検討であり、現行migrationの`anon` SELECT grantは正式仕様ではない。

ステータス: `文書未追従`

## 5. 採用仕様にコードを合わせる必要がある項目

次は仕様の再判断ではなく、決定後または決定済み契約へ実装を追従させる作業である。

| ID | 現行コードの状態 | 必要な対応 |
|---|---|---|
| `FIX-01` | `initialize-user`が`.rpc("private.initialize_user")`を呼ぶ | Supabase JSから実際に到達可能な公開ラッパー等へ変更し、`private`関数は直接公開しない |
| `FIX-02` | `sync-health-steps`が`.rpc("public.sync_step_rewards")`を呼ぶ | RPC名をPostgRESTの呼び出し規則へ合わせる |
| `FIX-03` | 新規Auth登録後に`initialize-user`を呼ぶ経路がない | `DEC-03`で選んだ契機を実装する |
| `FIX-04` | 既存townに初期台帳だけ不足する場合、+1000台帳を追加しても残高を増やさない | 残高と台帳を同じ原子的処理で常に一致させる |
| `FIX-05` | seed・一部DBテストが`house-small`等の旧codeを使用 | 正式snake_case codeへmigration・seed・テストを統一する |
| `FIX-06` | seedに正式9建物以外の`future-building`行がある | Phase 0の正式カタログへ合わせてseedから削除する |
| `FIX-07` | 現行街RPCが裸JSON、camelCase、SQL exceptionを使用 | envelope、snake_case、ドメインエラーHTTP 200へ統一する |
| `FIX-08` | `place_building`は増分加算、`move_building`は人口再計算なし | 全人口効果と配置関係を集計する共通人口再計算へ統一する |
| `FIX-09` | 通常道路の一括配置で既存道路をskipする | 2026-08-30改定で現行方針を採用。重複セルを課金対象からも除外する |
| `FIX-10` | `rename_building`、`unlock_land`、4つの読取Viewがない | 採用契約に従って追加する |
| `FIX-11` | RLSが全town・全配置・全開放領域の行読取を許し、カタログの`anon` grantも残る | security_invoker Viewに必要な公開列だけを列権限とRLSで許可する |
| `FIX-12` | `public.health_connections.refresh_token`をEFが平文読取 | 暗号化済みtokenを`private.health_tokens`へ移し、専用DB関数経由にする |
| `FIX-13` | `sync-health-steps`が`dataPoints[].value.steps.countSum`を読む | `dailyRollUp`の実レスポンス形へパーサーを合わせる |
| `FIX-14` | EFがRPC前に`rewarded_steps`を読み`newlyRewardedSteps`を計算 | 同時実行でも一致する値を、ロックしたRPC結果から返す |
| `FIX-15` | `steps_to_coins_rate`未設定時は0 | `DEC-10`の設定をmigration/設定表で必須化する |
| `FIX-16` | `google_health_fetch`、`health_steps_fetch`、`sync-health-steps`が併存 | `DEC-11`の責務分担に従って削除・非公開化・統合する |
| `FIX-17` | OAuth開始・callback・切断用EF、`private.health_tokens` migrationがない | 分離OAuthの設計どおり実装する |
| `FIX-18` | `Supabaseバックエンド実装計画書`の実装済み/未実装表が`8c42688`追加コードを反映していない | 計画書の現状欄を更新する |
| `FIX-19` | 新EF、初期化、View、RLS、同時実行のDB統合テストがない | Supabaseローカル環境で契約・冪等性・権限テストを追加する |

## 6. 判断不要とした項目

次は現時点では矛盾として扱わない。

- 建物価格はPhase 0で「暫定値」と明記されており、`バックエンド.md`の正式価格TBDと両立する。
- 農場、役所、工場を含む建物効果は「建物効果仕様」に統一した。
- `getDashboard()`を作らず既存APIを組み合わせる方針は一致した。
- `renameBuilding()`を実装する方針は一致した。
- GoogleログインとHealth同意の分離、v4 `dailyRollUp`、暗号化token保存の方針は文書上で一致した。
- 道路・橋の移動不可、通常道路1セル削除、橋7セル一括削除、返金なしは川・橋関連文書と現行API設計で一致している。
- 川以外の障害物は、MVPでは`obstacles: []`とするPhase 0の暫定仕様を採用できる。

## 7. 確定した回答

確定済みの回答:

```text
DEC-01=改定  # 画像指定の全建物効果を採用し、道路の強制はマップルールで行う
DEC-02=A  # 効果説明はService生成
DEC-03=A  # Auth callback後にinitialize-userを呼ぶ
DEC-04=B  # UUID先頭8文字
DEC-05=B  # 次回ログイン時に不足データを遅延作成
DEC-06=B  # 表示名・街名変更はMVP対象外
DEC-07=A  # 土地開放を今回実装
DEC-08=A  # 川・橋を正式採用
DEC-09=A  # map_layout_idはtext
DEC-10=10歩で1コイン、端数切捨て、日次上限なし
DEC-11=A  # 歩数取得系EFをsync-health-stepsへ統合
DEC-12=改定  # appliedBonusesは建物ボーナスの内訳を返す
DEC-13=A  # 共通ApiErrorCodeへ統一
DEC-14=B  # isCurrentUserはServiceで比較
```

実装時はPhase 0契約決定書を正本とし、関連Design Doc、Supabase migration/EF、フロント型、契約テストを同じ変更で同期する。
