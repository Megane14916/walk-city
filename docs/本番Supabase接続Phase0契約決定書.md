# Walk City 本番 Supabase 接続 Phase 0 契約決定書

| 項目 | 内容 |
|---|---|
| ステータス | Phase 0 決定済み（仮決定を含む） |
| 作成日 | 2026-08-29 |
| 対象 | `walk-city/frontend` と本番 Supabase の境界 |
| 最優先の正 | [バックエンド設計書](./バックエンド.md) |
| 実装基準 | `main` / `549b1cb` |

## 1. 目的と決定ルール

本書は、本番 Supabase 接続を開始するために必要なAPI契約、認可、レスポンス、暫定ゲーム設定を固定する。

決定の優先順位は次のとおりとする。

1. 本書作成時の指示: `バックエンド.md` に従う。
2. [バックエンド.md](./バックエンド.md) の記述。
3. `バックエンド.md` で未確定の事項は、本書の仮決定。
4. フロントエンドの既存 interface は、バックエンド設計に反しない範囲で互換性を維持する。

`API計画書.md`、`フロントエンド.md`、機能別Design Docと矛盾する場合は、`バックエンド.md`を採用する。

### 1.1 決定区分

| 表記 | 意味 |
|---|---|
| `BE確定` | `バックエンド.md`に根拠があり、本書では変更しない |
| `仮決定` | `バックエンド.md`では未確定のため、本書で一時的に固定した |
| `FE互換` | 現行フロントエンドの型・UIとの接続に必要な変換。バックエンドの正データは変更しない |

仮決定は実装を進めるための既定値であり、正式決定時には本書、バックエンド実装、フロントエンド、テストを同じ変更で更新する。

## 2. 参照箇所

### 2.1 正として参照した箇所

| 参照箇所 | 採用した内容 |
|---|---|
| `バックエンド.md` §2 | Supabase Auth、PostgreSQL、RLS、Edge Functions、Google Health API |
| §3 セキュリティ | 外部APIはEF経由、DB更新はRPC、秘密情報をブラウザへ保存しない |
| §4.1 | コイン、人口、価格、サイズ、効果、ユーザーIDをクライアント入力として信用しない |
| §4.2 | 歩数精算、購入配置、移動、土地開放を原子的に実行する |
| §5 | 正式なテーブル名、列、PostgreSQL型 |
| §5.6、§7.5 | 初期開放は中央 `(40,40)` から20×20、土地開放方式は未確定 |
| §5.7 | 歩数の日付境界は `Asia/Tokyo` |
| §6 | 正式な初期建物codeと確定済み効果 |
| §7.1 | `sync-health-steps` の責務と差分精算 |
| §7.2 | `place_building` の検証・更新内容 |
| §7.3 | `move_building` の検証、移動時コイン消費なし |
| §7.4 | 人口はバックエンド計算、住宅（小）+10、住宅（大）+50。農場・役所に人口効果はない |
| §7.6 | ランキングは `towns.population` 降順 |
| §8 | Auth、RLS、公開・非公開範囲、直接書込み禁止 |
| §9 | EF / RPC / 通常Queryの分担 |
| §10、§11 | エラーコードと `{ ok, data/error }` 形式 |
| §12 | Google Health scope・endpoint、土地開放はコイン方式が有力、ランキング仕様は未確定 |

### 2.2 互換性確認にだけ使用した箇所

以下は正ではなく、現在のフロントエンドと接続するために参照した。

| 参照 | 用途 |
|---|---|
| `frontend/src/features/town/api/town-api.ts` | 現在UIが要求するTown操作の一覧 |
| `frontend/src/features/town/types.ts` | camelCaseの画面用型、`requestId`、返却型 |
| `frontend/src/features/ranking/types.ts` | cursorを持つ既存ページングinterface |
| `frontend/src/types/common.ts` | 現在UIが処理できるエラーコード |
| `frontend/src/features/town/utils/land-unlock.ts` | 20×20・1000コインの現行暫定UI |

`建物詳細・表示名変更API設計書.md`の`renameBuilding()`契約を採用する。`custom_name`列は[Supabaseバックエンド実装計画書.md](./Supabaseバックエンド実装計画書.md) §3.1で確認済みのとおり後続migrationで`placed_buildings`へ追加済みのため、本番契約の根拠として利用する。

## 3. Phase 0 の結論

### 3.1 本番接続対象

| フロントエンド関数 | 今回 | 決定区分 | 備考 |
|---|---:|---|---|
| `getBuildingCatalog()` | 実装 | `BE確定` | 通常Query |
| `getMyTown()` | 実装 | `BE確定` | 通常Query |
| `getPublicTown(userId)` | 実装 | `BE確定` | 公開項目だけを返す通常Query |
| `getPopulationRanking(input)` | 実装 | `BE確定` | 通常Query。詳細ページングは仮決定 |
| `placeBuilding(input)` | 実装 | `BE確定` | `place_building` RPC |
| `moveBuilding(input)` | 実装 | `BE確定` | `move_building` RPC |
| `placeRoadLine(input)` | 実装 | `仮決定` | 原子的な`place_road_line` RPCを追加 |
| `unlockLand(input)` | 実装 | `仮決定` | コイン消費の`unlock_land` RPCを追加 |
| `renameBuilding(input)` | 実装 | `仮決定` | `rename_building` RPCを追加。`placed_buildings.custom_name`は追加済み |
| `getDashboard()` | 実装しない | 本書作成時の指示 | 既存APIの組合せで表示する |

本番モードでも建物名変更UIを有効にする。`PlacedBuilding.customName`は`rename_building`で更新した実値を返す（`BE確定`: [建物詳細・表示名変更API設計書.md](./建物詳細・表示名変更API設計書.md)）。

### 3.2 通信方式

| 種類 | 通信方式 | 根拠 |
|---|---|---|
| Googleログイン | Supabase Auth | `バックエンド.md` §2、§8 |
| Google Health/OAuth/歩数取得 | Edge Function | §2、§3、§9 |
| カタログ、自分の街、公開街、ランキング | Viewへの通常Query | §9 |
| 購入配置、道路一括配置、移動、土地開放 | DB Function / RPC | §3、§4.2、§9 |
| コイン・人口更新 | RPC内部のDBトランザクション | §4.1、§4.2、§7 |

## 4. 物理APIと仮名称

`バックエンド.md`に物理名があるものはその名前を採用し、ないものは以下で仮固定する。

| 用途 | Supabase物理名 | 種類 | 決定区分 |
|---|---|---|---|
| 建物カタログ | `building_catalog_view` | View | `仮決定` |
| 自分の街 | `my_town_details_view` | View | `仮決定` |
| 公開街 | `public_town_details_view` | View | `仮決定` |
| 人口ランキング | `population_ranking_view` | View | `仮決定` |
| 建物購入配置 | `place_building` | RPC | `BE確定`（§7.2） |
| 建物移動 | `move_building` | RPC | `BE確定`（§7.3） |
| 道路一括配置 | `place_road_line` | RPC | `仮決定` |
| 土地開放 | `unlock_land` | RPC | `仮決定` |
| 歩数同期 | `sync-health-steps` | Edge Function | `BE確定`（§7.1） |
| 初回profile/town作成 | `initialize-user` | Edge Function | `仮決定`。処理責務は§3、§5.1で確定 |

Viewは`security_invoker = true`を使用し、基礎テーブルのRLSを適用する（確定。[Supabaseバックエンド実装計画書.md](./Supabaseバックエンド実装計画書.md) §3.2）。公開用SECURITY DEFINER関数への切り替えは行わない。認証ユーザーが基礎テーブルの公開列を直接Queryできること自体は許容し、非公開列（coins、歩数、Health情報など）は列権限とRLSの両方で非公開にすることで秘匿性を担保する。公開Viewはcoins、歩数、Health情報を列として持たない。

## 5. 共通契約

### 5.1 命名と変換

- DB、View、RPC引数は`snake_case`とする（`BE確定`: §5のデータモデルに準拠）。
- React側の公開型は既存どおり`camelCase`とする（`FE互換`）。
- snake_caseからcamelCaseへの変換は各Supabase Service内だけで行う。
- Component、HookへView名、RPC名、Postgres型を漏らさない。

### 5.2 レスポンス

フロントエンドServiceの公開境界は常に次の形式とする（`BE確定`: §11）。

```ts
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string } }
```

- RPC / EFは上記JSON envelopeを直接返す。
- 通常QueryはSupabase SDKの`data/error`をServiceが`ApiResult<T>`へ正規化する（`FE互換`）。
- 日時はISO 8601の`string`、DBでは`timestamptz`とする。
- `bigint`はJavaScriptの安全な整数範囲内でnumberへ変換し、範囲外は`INTERNAL_ERROR`とする（`仮決定`）。
- 配列が0件の場合は`[]`、値が存在しない場合は`null`を返す。

### 5.3 認証と入力の信頼境界

次の値を更新リクエストに含めない（`BE確定`: §4.1）。

- userId / ownerId / townId
- coins / coinBalance
- population
- costCoins
- width / height
- building effects
- editable

認証ユーザーはJWTから、街・価格・サイズ・効果はDBから決定する。

## 6. 読み取り契約

### 6.1 `getBuildingCatalog()`

```text
from building_catalog_view
select *
order by code asc
```

返却値は`BuildingCatalogItem[]`とする。

| フロント項目 | DB/Viewの正 | 決定区分 |
|---|---|---|
| `code` | `building_types.code` | `BE確定` |
| `name` | `building_types.name` | `BE確定` |
| `category` | `building_types.category` | `BE確定` |
| `width`, `height` | 同名列 | `BE確定` |
| `costCoins` | `cost_coins` | `BE確定` |
| `enabled` | `enabled` | `BE確定` |
| `description` | `building_types.description` | `BE確定` |
| `effects` | `building_effects`をJSON配列化 | `BE確定` |
| `assetKey` | `code`と同じ値 | `仮決定`。DB列は追加しない |
| `catalogVersion` | `catalog_version` | `BE確定` |

`building_effects`に表示用description列はないため、既知のeffect typeはServiceで説明文を生成し、未知のeffectは空文字列とする（`FE互換・仮決定`）。

### 6.2 `getMyTown()`

```text
from my_town_details_view
select *
single
```

- `auth.uid()`がownerの街だけを返す。
- `towns.coins`を含む。
- profiles、placed_buildings、unlocked_areasを集約する。
- 障害物は仕様未確定のため`obstacles: []`とする（`BE確定`: §5.10）。
- `editable: true`はServiceで付加する（`FE互換`）。
- `catalogVersion`は有効な`building_types.catalog_version`の最大値とする（`仮決定`）。
- 街が存在しない場合は`NOT_FOUND`。初回作成失敗とみなし、勝手にブラウザからinsertしない。

### 6.3 `getPublicTown(userId)`

```text
from public_town_details_view
select *
eq owner_id = userId
single
```

- 初期版はログイン済みユーザーだけが利用できる（`仮決定`）。
- coins、coin_ledger、歩数、email、Health情報をViewの列に含めない（`BE確定`: §8）。
- profilesの`id`と`display_name`、街名、人口、建物、開放領域を返す。
- `editable: false`をServiceで付加する（`FE互換`）。
- 存在しない場合は`NOT_FOUND`。

### 6.4 `getPopulationRanking(input)`

```text
from population_ranking_view
select rank, user_id, display_name, town_id, town_name, population
range offset..offset+limit
```

| 項目 | 決定 | 区分・根拠 |
|---|---|---|
| 人口の正 | `towns.population` | `BE確定`: §7.6 |
| 並び順 | population desc、display_name asc、user_id asc | 名前は§12の案、user_idは`仮決定` |
| 同率順位 | `rank()`方式。例: 1, 2, 2, 4 | `仮決定` |
| 既定件数 | 20 | `仮決定` |
| 最大件数 | 100 | `仮決定` |
| DBページング | offset / range | §12の案を採用 |
| FE cursor | `offset:<次のoffset>` | `FE互換・仮決定` |
| 自分判定 | `user_id === auth.uid()` | `仮決定` |

Serviceは`limit + 1`件を取得し、次行がある場合だけ`nextCursor`を返す。cursorはComponentから見て不透明な文字列として扱う。人口はフロントエンドで再計算しない。

## 7. 更新契約

### 7.1 `placeBuilding(input)` → `place_building`

物理引数:

```ts
{
  p_building_type_code: string
  p_anchor_x: number
  p_anchor_y: number
  p_request_id: string // UUID
}
```

`p_request_id`は`coin_ledger.idempotency_key`へ組み込み、二重購入を防ぐ（`仮決定`。台帳の一意キー自体は§5.8で確定）。

RPCは§7.2の順で所有権、カタログ、境界、開放、衝突、道路、残高を検証し、購入・配置・人口更新を一つのトランザクションで実行する。

成功data:

```ts
type TownMutationResult = {
  building: PlacedBuilding
  coinBalance: number
  population: number
  updatedAt: string
}
```

これは§7.2の「更新後の街スナップショット」のうち、UIの即時反映に必要な確定値を返す最小スナップショットとして扱う（`仮決定`）。競合時は`getMyTown()`で全体を再取得する。

### 7.2 `moveBuilding(input)` → `move_building`

```ts
{
  p_building_id: string
  p_anchor_x: number
  p_anchor_y: number
  p_request_id: string // UUID
}
```

- 所有権、境界、開放、衝突、道路条件を再検証する（`BE確定`: §7.3）。
- 移動対象自身を衝突判定から除外する（`仮決定`）。
- コインを消費せず、coin_ledgerを更新しない（`BE確定`）。
- 移動後に人口を再計算し、`TownMutationResult`を返す。
- 同じrequestId・同じ入力は同じ結果、同じrequestId・異なる入力は`CONFLICT`とする（`仮決定`）。

requestIdの保存方式はバックエンド内部実装に委ねるが、RPC契約上の冪等性は必須とする。

### 7.3 `placeRoadLine(input)` → `place_road_line`

道路も`building_types.code = 'road'`の配置物として保存する（`BE確定`: §3、§6、§7.2）。現在の一括UIに合わせ、次を仮決定する。

```ts
{
  p_building_type_code: "road"
  p_cells: Array<{ x: number; y: number }>
  p_request_id: string // UUID
}
```

- 1〜100セル。
- 重複セルを拒否する。
- 全セルは縦または横の連続した直線とする。
- 全セルを一つのトランザクションで購入・配置する。
- 最初の道路は任意の開放済み・未占有セルへ配置可能とする。
- 道路同士の隣接条件は設けない。
- 部分成功を禁止する。
- 成功時は`PlaceRoadLineResult`を返す。

すべて`仮決定`だが、原子性は§4.2に従う。

### 7.4 `unlockLand(input)` → `unlock_land`

§7.5と§12を基に、ハッカソン版は次で仮固定する。

```ts
{
  p_x: number
  p_y: number
  p_request_id: string // UUID
}
```

- 保存方式は`unlocked_areas`。
- 暫定列は`town_id uuid`、`x smallint`、`y smallint`、`width smallint`、`height smallint`、`unlocked_at timestamptz`、`unlock_method text`とする。
- `unique(town_id, x, y, width, height)`を設定する。
- 開放単位は20×20。
- x、yは20の倍数で、100×100内に収まること。
- 既存開放領域と上下左右のいずれかで辺が接すること。斜めは不可。
- 開放済み領域の再指定は`AREA_ALREADY_UNLOCKED`。
- 非隣接は`AREA_NOT_ADJACENT`。
- コストは1000コイン。
- coin_ledger reasonは`land_unlock`。
- 残高減算と領域追加を一つのトランザクションで行う。
- 同じrequestIdの再送で二重消費しない。

20×20・1000コインは現行フロントエンドに合わせた`仮決定`であり、`バックエンド.md`で確定しているのは初期20×20と原子的更新までである。

### 7.5 `renameBuilding(input)` → `rename_building`

本番でも実装する。`placed_buildings.custom_name`列は既に追加済みのため（[Supabaseバックエンド実装計画書.md](./Supabaseバックエンド実装計画書.md) §3.1）、[建物詳細・表示名変更API設計書.md](./建物詳細・表示名変更API設計書.md)の契約をそのまま採用する。

物理引数:

```ts
{
  p_building_id: string // UUID
  p_custom_name: string | null
}
```

- JWTから認証ユーザーを特定し、対象建物の所属する街の所有者であることを検証する（`NOT_OWNER`）。
- `p_custom_name`が文字列の場合、前後空白を除去し1〜30 Unicodeコードポイント、制御文字なしを検証する（`INVALID_INPUT`）。
- カタログ初期名と同じ場合、または`p_custom_name`が`null`の場合は`custom_name = NULL`にする。
- `custom_name`と`placed_buildings.updated_at`だけを更新し、コイン・人口・建物効果・作成日時は変更しない。
- `requestId`と冪等性台帳は追加しない（同じ値を設定する操作のため、再送しても副作用が累積しない）。

成功data:

```ts
type RenameBuildingResult = {
  building: PlacedBuilding
  updatedAt: string
}
```

`my_town_details_view` / `public_town_details_view`が返す`PlacedBuilding.customName`は`custom_name`の実値を返す（[Supabaseバックエンド実装計画書.md](./Supabaseバックエンド実装計画書.md) §6.1の「`custom_name`は`null`」という記述はこの変更に合わせて更新する）。

## 8. 暫定カタログ設定

正式codeは`バックエンド.md` §6をそのまま採用する。旧codeの`house-small`、`park`、`commercial-facility`、`city-hall`は本番codeとして採用しない。`apartment`は住宅（大）の正式codeとして採用する。

価格が§6でTBDのため、現在のUI価格を正式codeへ対応させて仮設定する。

| code | name | size | costCoins | enabled | 効果 | 区分 |
|---|---|---:|---:|---:|---|---|
| `small_house` | 住宅（小） | 1×1 | 50 | true | population_flat +10 | 効果は`BE確定`、価格は`仮決定` |
| `apartment` | 住宅（大） | 2×2 | 200 | true | population_flat +50 | ユーザー決定、価格は`仮決定` |
| `small_park` | 公園 | 1×1 | 150 | true | なし | 価格は`仮決定` |
| `hospital` | 病院 | 2×2 | 600 | true | なし | 価格は`仮決定` |
| `commercial` | 商業施設 | 1×1 | 300 | true | step_coin_bonus_flat +50 | 価格・効果量は`仮決定` |
| `farm` | 農場 | 2×2 | 100 | true | なし | 効果は`BE確定`、価格は`仮決定` |
| `road` | 道路 | 1×1 | 0 | true | enables_adjacent_construction | 隣接規則は確定、価格は`仮決定` |
| `town_hall` | 役所 | 2×2 | 3000 | true | なし | 価格は`仮決定` |
| `factory` | 工場 | 2×2 | 700 | true | なし | ユーザー決定、価格は`仮決定` |

道路隣接は上下左右の4方向とし、斜めは含めないことを確定する（`BE確定`。[API計画書.md](./API計画書.md) §7を参照）。

追加仮決定:

- 商業施設の+50は、新規精算歩数が1歩以上ある日の同期で建物1つにつき1日1回だけ付与する。日付・建物IDを冪等性キーへ含める。
- 初期ユーザーには1000コインを付与する。§12のデモ案を採用した`仮決定`。
- `apartment`を本番カタログへ含める。

## 9. 人口・ランキングの整合性

- 人口は配置済み建物と`building_effects`からバックエンドで計算する（`BE確定`: §7.4）。
- 住宅（小）+10、住宅（大）+50。農場に人口効果はない。
- `place_building`、`place_road_line`、`move_building`のトランザクション内で必要に応じて`towns.population`を更新する。
- `population_ranking_view`は保存済みの`towns.population`だけを参照する。
- フロントエンドは順位・人口を計算しない。
- 建物配置成功後にランキングを再取得すると、更新後人口と順位を返す。
- Realtime購読はPhase 0対象外とする（`仮決定`）。

## 10. Auth・Google Health契約

Googleログインと歩数読み取りscopeの要求を分離する（[Google認証機能DesignDoc.md](./Google認証機能DesignDoc.md) §3.1、`バックエンド.md` §8 改訂後の記述を優先）。ログイン用scopeとHealth用scopeを同時に要求しない。

追加scope:

```text
https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
```

歩数endpoint:

```text
POST https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp
```

（v1は現在のGoogle公式仕様に存在しないため、v4の`dailyRollUp`を正とする。[Supabaseバックエンド実装計画書.md](./Supabaseバックエンド実装計画書.md) §3.2の調査結果を反映）

- 認可方式はOAuth 2.0。
- ブラウザからGoogle Health APIを直接呼ばない。
- 認可コード、access tokenはEdge Function内だけで扱い、DBやレスポンスへ保存・返却しない。refresh tokenは暗号化した上でユーザーごとに`private.health_tokens`（`anon`/`authenticated`からアクセス不可）へ保存し、暗号鍵だけをEF Secretsに保存する。詳細は[バックエンド.md](./バックエンド.md) §5.13、[Supabaseバックエンド実装計画書.md](./Supabaseバックエンド実装計画書.md) §3.2を参照。
- 日付境界は`Asia/Tokyo`。
- 歩数値、ユーザーID、付与コインをフロントエンドから`sync-health-steps`へ送らない。

現在のフロントエンド（ログインとHealth連携を別操作として分離する実装。ステータス「実装完了」）を正とする。バックエンド側もログイン用とHealth用のOAuthクライアントを分離し（[Google認証機能DesignDoc.md](./Google認証機能DesignDoc.md) §3.4）、`begin-google-health-auth` / `google-health-callback` Edge Functionを歩数連携の追加認可専用として実装する。

## 11. エラー契約

### 11.1 `バックエンド.md`で確定しているコード

```text
UNAUTHENTICATED
HEALTH_NOT_CONNECTED
HEALTH_PERMISSION_REQUIRED
HEALTH_PROVIDER_ERROR
INVALID_INPUT
CATALOG_ITEM_DISABLED
PRICE_NOT_SET
INSUFFICIENT_COINS
OUT_OF_MAP
LAND_LOCKED
CELL_OCCUPIED
ROAD_REQUIRED
NOT_OWNER
NOT_FOUND
CONFLICT
```

### 11.2 本書で仮追加するコード

| code | 用途 | 区分 |
|---|---|---|
| `AREA_ALREADY_UNLOCKED` | 土地が既に開放済み | `仮決定` |
| `AREA_NOT_ADJACENT` | 開放領域が既存領域に隣接しない | `仮決定` |
| `INTERNAL_ERROR` | 詳細を公開できない予期しない失敗 | `仮決定`。§10の秘匿方針に基づく |

道路一括配置の空配列、非直線、重複セルは`INVALID_INPUT`を使用し、新しいコードを増やさない。

HTTP statusの仮対応（[Supabaseバックエンド実装計画書.md](./Supabaseバックエンド実装計画書.md) §3.2を正とする）:

PostgRESTのDB RPCは、期待されるゲームエラーをJSON envelopeとして返す場合、通常はHTTP 200になる。SQL exceptionでHTTPエラーにすると、レスポンスがこの文書の独自envelopeにならないため、より強い共通契約であるJSON envelopeを優先する。

| ケース | HTTP status | 例 |
|---|---:|---|
| 認証済みの期待可能なドメインエラー | 200（`{ ok: false, error }`） | `INVALID_INPUT`、`NOT_OWNER`、`NOT_FOUND`、`CONFLICT`、`INSUFFICIENT_COINS`、`CELL_OCCUPIED`、`AREA_ALREADY_UNLOCKED`など全ゲームルール系コード |
| JWT不正・権限不足・DB障害などRPC外側の失敗 | 非2xx | `UNAUTHENTICATED`、`INTERNAL_ERROR` |

フロントエンドのServiceは、RPC呼び出しが例外的な非2xxを返した場合も`ApiResult`へ正規化する。HTTP statusも厳密に統一する必要が生じた場合は、更新APIをEdge Functionで包む別Phaseとする。

内部SQL、token、外部APIの生レスポンス、stackを`message`や`details`に含めない（`BE確定`: §10）。

## 12. RLS・公開範囲

`バックエンド.md` §8をそのまま採用する。

- profilesの本人更新は可能。他ユーザー更新は不可。
- 公開profilesはログイン済みユーザーが読める。
- 自分のtown、placed_buildings、unlocked_areasは本人が読める。
- 他ユーザーの街は`public_town_details_view`の公開列だけ読める。
- town、placed_buildings、coins、populationをブラウザから直接insert/updateできない。
- カタログはログイン済みユーザーが読める。書込みは管理処理だけ。
- coin_ledgerは本人だけ読める。
- 更新は`SECURITY DEFINER` RPCとし、関数内で`auth.uid()`、所有権、入力を検証する（`仮決定`）。
- `search_path`を固定し、不要な`PUBLIC EXECUTE`を剥奪する（`仮決定`）。

公開街レスポンスに含めてよいもの:

- userId、displayName
- townId、townName、population、mapWidth、mapHeight
- buildings、unlockedAreas

含めないもの:

- coins
- email
- daily_step_records
- health_connections
- coin_ledger
- OAuth/token情報

## 13. 冪等性

| 操作 | キー | 再送時の動作 | 区分 |
|---|---|---|---|
| 歩数同期 | userId + date + source / ledger key | 未精算差分だけ処理 | `BE確定` |
| 建物購入 | requestId | 同じ入力は同じ結果、異なる入力は`CONFLICT` | `仮決定` |
| 道路一括配置 | requestId | 全体を一回だけ処理 | `仮決定` |
| 建物移動 | requestId | 同じ入力は同じ結果、異なる入力は`CONFLICT` | `仮決定` |
| 土地開放 | requestId | 二重消費・二重開放しない | `仮決定` |

requestIdはUUIDとし、クライアントが生成する。タイムアウト後に同じ操作を再送するときは同じrequestIdを使う。

## 14. Phase 0 完了条件

本書の作成により、以下をPhase 0の決定事項とする。

- 本番接続対象と対象外が確定している。
- Query / RPC / EFの分担が確定している。
- 物理名が仮名を含めて一意に決まっている。
- request、response、認証、公開範囲が決まっている。
- 正式な建物codeと暫定価格が決まっている。
- ランキングの順序、同率、ページサイズ、cursor変換が決まっている。
- 道路一括配置と土地開放の暫定ルールが決まっている。
- 建物名変更(`renameBuilding`)を実装し、`getDashboard()`は実装しないことが決まっている。
- 確定事項と仮決定の根拠が区別されている。

次の実装フェーズでは、本書を契約としてSupabase Serviceを作成する。実DBに既に異なる物理名が存在する場合は、コードだけで吸収せず、本書の仮決定を更新してから実装する。
