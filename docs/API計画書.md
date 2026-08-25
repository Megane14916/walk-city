# Walk City API 設計書

## 1. この文書の目的

React フロントエンドと Supabase バックエンドを別担当者が並行開発するための共有契約を定義する。

この文書の型・操作・エラーコードを変更するときは両担当者で共有する。ゲームバランス値は API が返す設定を正とし、フロントエンドへ複製しない。

## 2. 通信方式

| 用途 | 推奨方式 |
|---|---|
| Google ログイン | Supabase Auth SDK |
| Google Health 歩数同期 | Supabase Edge Function |
| 購入・配置・移動 | Supabase RPC / DB Function |
| カタログ・街・ランキング読取 | Supabase SDK、View または RPC |

フロントエンドのサービス層では通信方式の違いを隠し、TypeScript の一貫した関数として公開する。

## 3. 共通ルール

### 認証

- 認証が必要な操作には Supabase セッションの JWT を使用する。
- リクエスト本文の `userId` を更新権限の根拠にしない。
- 自分の街を更新する API は JWT のユーザーから対象の街を解決する。

### 座標

- 原点は左上 `(0, 0)`。
- `x` は右、`y` は下へ増える。
- マップは最大 100×100、座標範囲は `0 <= x < 100`、`0 <= y < 100`。
- 配置座標は建物矩形の左上アンカー。
- 建物サイズはカタログの `width` と `height` を使用する。
- 回転値は送らない。

### 数値

- コイン、歩数、人口、座標、幅、高さは JSON の整数として扱う。
- コイン、人口、価格は 0 以上。
- 未確定価格は `null` で返し、同時に `enabled: false` とする。

### 日時

- 日時は ISO 8601 文字列で返す。
- 歩数集計の日付は `YYYY-MM-DD`。
- 日付境界のタイムゾーンは TBD。決定後、API の `timezone` として明示する。

## 4. レスポンスとエラー

Supabase SDK の生レスポンスを UI で直接扱わず、サービス層で次の型へ正規化する。

```ts
type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: {
        code: ApiErrorCode
        message: string
        details?: Record<string, unknown>
      }
    }
```

`message` は表示可能な一般メッセージとし、UI 分岐には安定した `code` を使用する。

```ts
type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'OAUTH_CANCELLED'
  | 'OAUTH_STATE_MISMATCH'
  | 'HEALTH_NOT_CONNECTED'
  | 'HEALTH_PERMISSION_REQUIRED'
  | 'HEALTH_PROVIDER_ERROR'
  | 'INVALID_INPUT'
  | 'CATALOG_ITEM_DISABLED'
  | 'PRICE_NOT_SET'
  | 'INSUFFICIENT_COINS'
  | 'OUT_OF_MAP'
  | 'LAND_LOCKED'
  | 'CELL_OCCUPIED'
  | 'ROAD_REQUIRED'
  | 'NOT_OWNER'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
```

## 5. 共通データ型

### `UserSummary`

```ts
type UserSummary = {
  id: string
  displayName: string
}
```

### `TownSummary`

```ts
type TownSummary = {
  id: string
  owner: UserSummary
  name: string
  coins?: number       // 自分の街だけに含める
  population: number
  mapWidth: 100
  mapHeight: 100
}
```

### `BuildingEffect`

```ts
type BuildingEffect = {
  type:
    | 'population_flat'
    | 'step_coin_bonus_flat'
    | 'residential_population_bonus'
    | 'enables_adjacent_construction'
    | string
  value: number | null
  targetCategory: string | null
  scope: string | null
  stackingRule: string | null
  description: string
  metadata: Record<string, unknown>
}
```

`type` は将来追加されるため、フロントエンドでは未知の文字列を受け入れる。

### `BuildingCatalogItem`

```ts
type BuildingCatalogItem = {
  code: string
  name: string
  category: string
  width: 1 | 2
  height: 1 | 2
  costCoins: number | null
  enabled: boolean
  description: string
  effects: BuildingEffect[]
  assetKey: string
  catalogVersion: number
}
```

### `PlacedBuilding`

```ts
type PlacedBuilding = {
  id: string
  buildingTypeCode: string
  anchorX: number
  anchorY: number
  createdAt: string
  updatedAt: string
}
```

サイズ・効果はカタログを参照する。購入後の価格は公開レスポンスへ含めない。

### `UnlockedArea`

土地開放の保存方式が未確定のため、クライアントには描画しやすい矩形として返す。

```ts
type UnlockedArea = {
  x: number
  y: number
  width: number
  height: number
}
```

初期状態では 20×20 の矩形を一つ返す。開始位置は TBD。

### `TownDetail`

```ts
type TownDetail = {
  town: TownSummary
  buildings: PlacedBuilding[]
  unlockedAreas: UnlockedArea[]
  obstacles: MapObstacle[]
  catalogVersion: number
  editable: boolean
}

type MapObstacle = {
  id: string
  type: string
  anchorX: number
  anchorY: number
  width: number
  height: number
}
```

障害物仕様が決まるまでは `obstacles: []` を返す。

### `StepSyncStatus`

```ts
type StepSyncStatus = {
  date: string
  timezone: string
  steps: number
  newlyRewardedSteps: number
  coinsAwarded: number
  coinBalance: number
  appliedBonuses: AppliedBonus[]
  syncedAt: string
}

type AppliedBonus = {
  sourceBuildingType: string
  sourceCount: number
  effectType: string
  amount: number
}
```

## 6. 認証 API

### `signInWithGoogle()`

Supabase Auth SDK を使用して Google OAuth を開始する。

```ts
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo }
})
```

Google ログインと Google Health 連携に必要な同意・スコープが異なる場合、歩数連携は別操作として提供する。具体的なスコープは採用する Google Health API の決定後に確定する。

### `signOut()`

Supabase Auth のセッションを終了する。Google Health 連携は解除せず、同じユーザーが再ログインしたときに接続状態を復元する。

### `getGoogleIntegrationState()`

用途: GoogleログインとGoogle Health連携状態の復元。

```ts
type GoogleIntegrationState = {
  session: {
    user: UserSummary & {
      email: string
      avatarUrl: string | null
    }
    expiresAt: string
  } | null
  healthConnection: {
    status: 'connected' | 'not_connected' | 'permission_required'
    scopes: string[]
    connectedAt: string | null
    lastSyncedAt: string | null
  } | null
}
```

未ログイン時は `session` と `healthConnection` を `null` とする。Googleのアクセストークン、更新トークン、クライアントシークレットを含めない。

### `startGoogleHealthConnection()`

Supabase JWTを検証後、歩数読み取り専用スコープのGoogle OAuth認可URLを生成する。

```ts
type StartGoogleHealthConnectionResult =
  | { next: 'redirect'; authorizationUrl: string }
  | { next: 'connected'; state: GoogleIntegrationState }
```

実APIは `redirect`、フロントエンド用モックは外部遷移を省略して `connected` を返す。詳細は [Google認証機能DesignDoc.md](./Google認証機能DesignDoc.md) を参照する。

### `disconnectGoogleHealth()`

保存済みGoogle Health認可情報を失効・削除し、接続状態を `not_connected` にする。Supabaseのログインセッションは終了しない。

## 7. 読み取り API

### `getDashboard()`

用途: ホーム初期表示。

```ts
type Dashboard = {
  user: UserSummary
  town: TownSummary
  todaySteps: number | null
  lastStepSyncAt: string | null
  healthConnectionStatus: 'connected' | 'not_connected' | 'permission_required'
}
```

### `getBuildingCatalog()`

用途: ショップと建物表示。レスポンスは `BuildingCatalogItem[]`。

初期カタログ:

| code | 名前 | サイズ | 効果 |
|---|---|---:|---|
| `small_house` | 住宅（小） | 1×1 | 人口 +10 |
| `small_park` | 公園（小） | 1×1 | なし |
| `hospital` | 病院 | 2×2 | なし |
| `commercial` | 商業施設 | 1×1 | コイン増加、値 TBD |
| `farm` | 農場 | 2×2 | 人口 +5 |
| `road` | 道路 | 1×1 | 周辺建築許可、範囲 TBD |
| `town_hall` | 役所 | 2×2 | 住宅（小）1軒あたり人口 +20、範囲・重複 TBD |
| `factory` | 工場 | 2×2 | コイン増加、値 TBD |

価格 TBD の間は全項目を `costCoins: null`、`enabled: false` とする。

### `getMyTown()`

用途: 自分の街の表示・編集。レスポンスは `TownDetail`。`town.coins` を含み、`editable: true`。

### `getPublicTown(userId)`

用途: 他ユーザーの街の閲覧。レスポンスは `TownDetail`。`town.coins` を含めず、`editable: false`。

存在しない、または将来非公開設定が追加された街には `NOT_FOUND` を返す。

### `getPopulationRanking(input)`

```ts
type RankingRequest = {
  limit?: number
  cursor?: string
}

type RankingEntry = {
  rank: number
  userId: string
  displayName: string
  townId: string
  townName: string
  population: number
  isCurrentUser: boolean
}

type RankingPage = {
  entries: RankingEntry[]
  nextCursor: string | null
}
```

上限件数、同率順位、カーソル仕様は TBD。レスポンス型はページングを追加しても画面の関数を変更しなくて済む形にする。

## 8. 歩数同期 API

### `syncSteps()`

Supabase Edge Function `sync-health-steps` を呼び出す。クライアントから歩数値、コイン量、対象ユーザー ID は送らない。

リクエスト:

```json
{}
```

成功レスポンス: `StepSyncStatus`

```json
{
  "ok": true,
  "data": {
    "date": "2026-08-25",
    "timezone": "Asia/Tokyo",
    "steps": 6500,
    "newlyRewardedSteps": 1500,
    "coinsAwarded": 0,
    "coinBalance": 0,
    "appliedBonuses": [],
    "syncedAt": "2026-08-25T12:00:00+09:00"
  }
}
```

例のコイン値は変換率未決定のため 0 としている。実装時はサーバー設定から計算する。

冪等性:

- 同じ Google Health データを再同期しても追加付与しない。
- 新しい歩数が増えている場合だけ未精算差分を処理する。
- ネットワーク再送や二重クリックでも残高を二重更新しない。

## 9. 街編集 API

### `placeBuilding(input)`

購入と配置を一括で行う。

```ts
type PlaceBuildingInput = {
  buildingTypeCode: string
  anchorX: number
  anchorY: number
  requestId: string
}
```

`requestId` はクライアントで生成する UUID とし、再送による二重購入を防ぐ。

```ts
type TownMutationResult = {
  building: PlacedBuilding
  coinBalance: number
  population: number
  updatedAt: string
}
```

サーバーは、種別・有効状態・価格、マップ境界、開放範囲、衝突、道路条件、残高を検証する。

### `moveBuilding(input)`

```ts
type MoveBuildingInput = {
  buildingId: string
  anchorX: number
  anchorY: number
  requestId: string
}
```

成功レスポンスは `TownMutationResult`。移動では購入費を消費しない。所有権、境界、開放範囲、衝突、道路条件を再検証する。

### `unlockLand(input)`（予約）

土地開放ルールの決定後に有効化する。

```ts
type UnlockLandInput = {
  areaId: string
  requestId: string
}
```

クライアントがコイン・アイテム・必要歩数を指定しない。`areaId` に対応するサーバー設定から条件を検証する。

### 建物削除

仕様が TBD のため API を定義しない。売却、返金、人口再計算のルール確定後に追加する。

## 10. 配置ルールの共有

フロントエンドはカタログのサイズと取得済み街データから事前プレビューできる。ただし次の最終判定は常にサーバーが行う。

```text
矩形が 100×100 内
  AND 全セルが開放済み
  AND 全セルが未占有
  AND 障害物と非衝突
  AND 道路ルールを満たす
  AND コインが十分
```

道路の周辺定義は TBD。確定前はクライアントとサーバーへ別々の仮定を実装しない。

## 11. API 契約テスト

- カタログに 1×1 と 2×2 が正しい型で含まれる。
- 効果なし建物は `effects: []` で返る。
- 未知の効果タイプを含むレスポンスをフロントが読み込める。
- 自分の街だけ `coins` が返る。
- 公開街に歩数、コイン、Google 連携情報が含まれない。
- 歩数同期の再送で二重付与されない。
- 2×2 建物の境界・衝突エラーコードが一致する。
- 同じ `requestId` の配置再送で二重購入されない。
- 他ユーザーの配置物を移動できない。
- ランキング人口と街詳細人口が一致する。

## 12. 変更管理

- API 型はフロントエンドとバックエンドで共有するか、自動生成することが望ましい。
- 破壊的変更では型または関数のバージョンを上げる。
- 建物価格・効果値の変更はカタログのバージョンを上げる。
- 未確定事項が決まったら、この文書、バックエンド設計書、該当テストを同時に更新する。

## 13. 未確定事項

- Google Health API と必要スコープ
- 日付境界のタイムゾーン
- 歩数からコインへの変換式
- 商業施設・工場のボーナス式
- 全建物のコスト
- 役所効果の範囲と重複ルール
- 道路の隣接ルール
- 土地開放ルールと初期 20×20 の位置
- 障害物、建物削除
- ランキングの同率・ページング仕様
