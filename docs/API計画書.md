# Walk City API 設計書

## 1. この文書の目的

React フロントエンドと Supabase バックエンドを別担当者が並行開発するための共有契約を定義する。

この文書の型・操作・エラーコードを変更するときは両担当者で共有する。ゲームバランス値は API が返す設定を正とし、フロントエンドへ複製しない。

## 2. 通信方式

| 用途                         | 推奨方式                      |
| ---------------------------- | ----------------------------- |
| Google ログイン              | Supabase Auth SDK             |
| Google Health 歩数同期       | Supabase Edge Function        |
| 購入・配置・移動             | Supabase RPC / DB Function    |
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
- 初期リリースの日付境界は `Asia/Tokyo` に固定し、API の `timezone` に同じ値を返す。

## 4. レスポンスとエラー

Supabase SDK の生レスポンスを UI で直接扱わず、サービス層で次の型へ正規化する。

```ts
type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ApiErrorCode;
        message: string;
        details?: Record<string, unknown>;
      };
    };
```

`message` は表示可能な一般メッセージとし、UI 分岐には安定した `code` を使用する。

```ts
type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "OAUTH_CANCELLED"
  | "OAUTH_STATE_MISMATCH"
  | "HEALTH_NOT_CONNECTED"
  | "HEALTH_PERMISSION_REQUIRED"
  | "HEALTH_PROVIDER_ERROR"
  | "INVALID_INPUT"
  | "CATALOG_ITEM_DISABLED"
  | "PRICE_NOT_SET"
  | "INSUFFICIENT_COINS"
  | "OUT_OF_MAP"
  | "LAND_LOCKED"
  | "CELL_OCCUPIED"
  | "ROAD_REQUIRED"
  | "RIVER_BLOCKED"
  | "BRIDGE_SPAN_REQUIRED"
  | "BRIDGE_DIRECTION_INVALID"
  | "BRIDGE_CORNER_FORBIDDEN"
  | "PLACEMENT_IMMOVABLE"
  | "DELETE_NOT_ALLOWED"
  | "ROAD_IN_USE"
  | "BRIDGE_GROUP_INVALID"
  | "AREA_ALREADY_UNLOCKED"
  | "AREA_NOT_ADJACENT"
  | "NOT_OWNER"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";
```

## 5. 共通データ型

### `UserSummary`

```ts
type UserSummary = {
  id: string;
  displayName: string;
};
```

### `TownSummary`

```ts
type TownSummary = {
  id: string;
  owner: UserSummary;
  name: string;
  coins?: number; // 自分の街だけに含める
  population: number;
  mapWidth: 100;
  mapHeight: 100;
};
```

### `BuildingEffect`

```ts
type BuildingEffect = {
  type:
    | "population_flat"
    | string;
  value: number | null;
  targetCategory: string | null;
  scope: string | null;
  stackingRule: string | null;
  description: string;
  metadata: Record<string, unknown>;
};
```

`building_effects`に表示用`description`列は置かない。SupabaseのViewは構造化された効果データを返し、フロントエンドServiceが既知の`type`を説明文へ変換する。未知の効果では`description: ""`とする。`type`は将来追加されるため、フロントエンドでは未知の文字列を受け入れる。

### `BuildingCatalogItem`

```ts
type BuildingCatalogItem = {
  code: string;
  name: string;
  category: string;
  width: 1 | 2;
  height: 1 | 2;
  costCoins: number | null;
  enabled: boolean;
  description: string;
  effects: BuildingEffect[];
  assetKey: string;
  catalogVersion: number;
};
```

### `PlacedBuilding`

```ts
type PlacedBuilding = {
  id: string;
  buildingTypeCode: string;
  anchorX: number;
  anchorY: number;
  roadStructureId: string | null;
  roadVariant: "normal" | "bridge_horizontal" | "bridge_vertical" | null;
  createdAt: string;
  updatedAt: string;
};
```

サイズ・効果はカタログを参照する。購入後の価格は公開レスポンスへ含めない。非道路では道路用フィールドを `null`、通常道路では `roadStructureId = null`、`roadVariant = "normal"` とする。橋の 7 セルは同じ非 null の `roadStructureId` を持つ。

### `UnlockedArea`

土地開放は`unlocked_areas`へ20×20の矩形として保存し、クライアントにも矩形として返す。

```ts
type UnlockedArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};
```

初期状態では `(40, 40)` を左上とする 20×20 の矩形を一つ返す。範囲は `40 <= x <= 59`、`40 <= y <= 59` とする。

### `MapLayout`

地形は全ユーザー共通の固定レイアウトとして返す。クライアントは描画と事前判定に使用し、最終判定ではサーバー上の同じレイアウトを参照する。

```ts
type MapTerrainArea = {
  id: string;
  code: string;
  terrainType: "river" | string;
  segmentKind: "horizontal" | "vertical" | "corner" | string;
  x: number;
  y: number;
  width: number;
  height: number;
  bridgeable: boolean;
};

type MapLayout = {
  id: string;
  version: number;
  bridgeCellCostCoins: number;
  terrainAreas: MapTerrainArea[];
};
```

### `TownDetail`

```ts
type TownDetail = {
  town: TownSummary;
  buildings: PlacedBuilding[];
  unlockedAreas: UnlockedArea[];
  obstacles: MapObstacle[];
  mapLayout: MapLayout;
  catalogVersion: number;
  editable: boolean;
};

type MapObstacle = {
  id: string;
  type: string;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
};
```

障害物仕様が決まるまでは `obstacles: []` を返す。

### `StepSyncStatus`

```ts
type StepSyncStatus = {
  date: string;
  timezone: string;
  steps: number;
  newlyRewardedSteps: number;
  coinsAwarded: number;
  coinBalance: number;
  appliedBonuses: AppliedBonus[];
  syncedAt: string;
};

type AppliedBonus = {
  sourceBuildingType: string;
  sourceCount: number;
  effectType: string;
  amount: number;
};
```

## 6. 認証 API

### `signInWithGoogle()`

Supabase Auth SDK を使用して Google OAuth を開始する。

```ts
supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo },
});
```

Google ログインと Google Health 連携に必要な同意・スコープが異なる場合、歩数連携は別操作として提供する。具体的なスコープは採用する Google Health API の決定後に確定する。

### `initializeUser()`

Google OAuth後の`/auth/callback`でセッションを復元した直後、`/health/connect`へ遷移する前に`initialize-user` Edge Functionを空bodyで呼ぶ。ユーザーIDはJWTから決定する。

```ts
type InitializeUserResult = {
  profileId: string;
  townId: string;
  created: boolean;
};
```

新規登録と再ログインはフロントで判定しない。`created`は今回の呼び出しで不足していた初期データを作成した場合に`true`、すでに初期化済みで何も作成しなかった場合に`false`とする。初期化済みユーザーへの再送は同じIDと`created: false`を返す。初期表示名と街名は認証ユーザーUUIDからハイフンを除いた先頭8文字を使う`user-xxxxxxxx`、`Town-xxxxxxxx`とする。導入前から存在するAuthユーザーも次回ログイン時に不足データだけを遅延作成し、全件backfill migrationは行わない。初期化失敗時はコールバック画面に留まり、再試行できるようにする。

プロフィール表示名と街名の変更APIはMVPでは定義しない。建物表示名の`renameBuilding()`は別機能として維持する。

### `signOut()`

Supabase Auth のセッションを終了する。Google Health 連携は解除せず、同じユーザーが再ログインしたときに接続状態を復元する。

### `getGoogleIntegrationState()`

用途: GoogleログインとGoogle Health連携状態の復元。

```ts
type GoogleIntegrationState = {
  session: {
    user: UserSummary & {
      email: string;
      avatarUrl: string | null;
    };
    expiresAt: string;
  } | null;
  healthConnection: {
    status: "connected" | "not_connected" | "permission_required";
    scopes: string[];
    connectedAt: string | null;
    lastSyncedAt: string | null;
  } | null;
};
```

未ログイン時は `session` と `healthConnection` を `null` とする。Googleのアクセストークン、更新トークン、クライアントシークレットを含めない。

### `startGoogleHealthConnection()`

Supabase JWTを検証後、歩数読み取り専用スコープのGoogle OAuth認可URLを生成する。

```ts
type StartGoogleHealthConnectionResult =
  | { next: "redirect"; authorizationUrl: string }
  | { next: "connected"; state: GoogleIntegrationState };
```

実APIは `redirect`、フロントエンド用モックは外部遷移を省略して `connected` を返す。詳細は [Google認証機能DesignDoc.md](./Google認証機能DesignDoc.md) を参照する。

### `disconnectGoogleHealth()`

保存済みGoogle Health認可情報を失効・削除し、接続状態を `not_connected` にする。Supabaseのログインセッションは終了しない。

## 7. 読み取り API

### ホーム初期表示（`getDashboard()` は実装しない）

専用の `getDashboard()` は追加しない。ホーム画面は次の既存 API の組み合わせで表示する（[本番Supabase接続実装計画書.md](./本番Supabase接続実装計画書.md) §2.1、[本番Supabase接続Phase0契約決定書.md](./本番Supabase接続Phase0契約決定書.md) §3.1）。

| 表示値 | 取得元 |
| --- | --- |
| ユーザー、街名、コイン、人口 | `getMyTown()` |
| 今日の歩数 | 初期表示は未同期状態。ユーザー操作後は`syncSteps()`の成功レスポンス |
| Health 接続状態、最終同期日時 | `getGoogleIntegrationState()` |

### `getBuildingCatalog()`

用途: ショップと建物表示。レスポンスは `BuildingCatalogItem[]`。

初期カタログ:

| code          | 名前       | サイズ | costCoins | enabled | 効果                                        |
| ------------- | ---------- | -----: | --------: | :-----: | ------------------------------------------- |
| `small_house` | 住宅（小） |    1×1 |        50 |  true   | 人口 +10                                    |
| `apartment`   | 住宅（大） |    2×2 |       200 |  true   | 人口 +50                                    |
| `small_park`  | 公園       |    1×1 |       150 |  true   | 隣接住宅（小）ごとに人口 +5（最大+20） |
| `hospital`    | 病院       |    2×2 |       600 |  true   | 町全体の人口 +10%                      |
| `commercial`  | 商業施設   |    1×1 |       300 |  true   | 歩数コイン +10%                          |
| `farm`        | 農場       |    2×2 |       100 |  true   | 人口 +20                                  |
| `road`        | 道路       |    1×1 |         0 |  true   | 隣接土地へ建物を配置可能                    |
| `town_hall`   | 役所       |    2×2 |     3,000 |  true   | 住宅（小）ごとに人口 +20               |
| `factory`     | 工場       |    2×2 |       700 |  true   | 歩数コイン +25%                          |

上記の価格は仮決定であり、正式な確定額ではない（[本番Supabase接続Phase0契約決定書.md](./本番Supabase接続Phase0契約決定書.md) §8）。価格が未設定の新規カタログ項目を追加する場合だけ `costCoins: null`、`enabled: false` とする。

`building_effects`は上記の全効果を構造化して返す。計算順序と重複上限は [建物効果仕様.md](./建物効果仕様.md) に従う。道路隣接と橋変換の強制は§9・§10のマップルールで行う。

### `getMyTown()`

用途: 自分の街の表示・編集。レスポンスは `TownDetail`。`town.coins` を含み、`editable: true`。

### `getPublicTown(userId)`

用途: 他ユーザーの街の閲覧。レスポンスは `TownDetail`。`town.coins` を含めず、`editable: false`。

存在しない、または将来非公開設定が追加された街には `NOT_FOUND` を返す。

### `getPopulationRanking(input)`

```ts
type RankingRequest = {
  limit?: number;
  cursor?: string;
};

type RankingEntry = {
  rank: number;
  userId: string;
  displayName: string;
  townId: string;
  townName: string;
  population: number;
  isCurrentUser: boolean;
};

type RankingPage = {
  entries: RankingEntry[];
  nextCursor: string | null;
};
```

ランキングViewは`user_id`を返し、フロントエンドServiceが取得済みAuthユーザーIDとの比較で`isCurrentUser`を付加する。判定用ユーザーIDはComponentやAPI入力から受け取らない。

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
    "coinsAwarded": 150,
    "coinBalance": 150,
    "appliedBonuses": [],
    "syncedAt": "2026-08-25T12:00:00+09:00"
  }
}
```

基本報酬は10歩につき1コイン、端数切り捨て、日次上限なしとする。同日の追加同期では`max(0, floor(totalSteps / 10) - floor(previousRewardedSteps / 10))`を基本付与額とし、分割同期で10歩未満の端数を失わない。その後、商業施設・工場の合算ボーナス率（最大50%）を適用する。

`appliedBonuses`は商業施設・工場のボーナスが実際に適用された場合に内訳を返す。`amount`は合算上限適用後のパーセントポイントとし、新規獲得コインが0なら`[]`を返す。

冪等性:

- 同じ Google Health データを再同期しても追加付与しない。
- 新しい歩数が増えている場合だけ未精算差分を処理する。
- ネットワーク再送や二重クリックでも残高を二重更新しない。

## 9. 街編集 API

### `placeBuilding(input)`

購入と配置を一括で行う。

```ts
type PlaceBuildingInput = {
  buildingTypeCode: string;
  anchorX: number;
  anchorY: number;
  requestId: string;
};
```

`requestId` はクライアントで生成する UUID とし、再送による二重購入を防ぐ。

```ts
type TownMutationResult = {
  building: PlacedBuilding;
  coinBalance: number;
  population: number;
  updatedAt: string;
};
```

サーバーは、種別・有効状態・価格、マップ境界、開放範囲、衝突、固定地形、道路条件、残高を検証する。道路以外の建物が川セルに重なる場合は `RIVER_BLOCKED` を返す。

### `placeRoadLine(input)`

連続した直線の道路を一括購入する。川と交差する場合、サーバーが通常道路か橋かを自動判定する。

```ts
type Cell = { x: number; y: number };

type PlaceRoadLineInput = {
  buildingTypeCode: string;
  cells: Cell[];
  requestId: string;
};

type PlaceRoadLineResult = {
  buildings: PlacedBuilding[];
  placementKind: "road" | "bridge";
  roadStructureId: string | null;
  totalCostCoins: number;
  coinBalance: number;
  population: number;
  updatedAt: string;
};
```

通常道路で既存の通常道路と重なるセルは、新規配置と`totalCostCoins`の対象から除外する。クライアントは橋判定、価格、構造 ID を送らない。橋は川と直交する連続 7 セル（陸 1 + 川 5 + 陸 1）に限定し、全セルが開放済み・未占有で、曲がり角を含まない場合だけ配置できる。川セルは 1 セル 200 コイン、両岸セルは通常道路価格としてサーバーが合計する。

### `moveBuilding(input)`

```ts
type MoveBuildingInput = {
  buildingId: string;
  anchorX: number;
  anchorY: number;
  requestId: string;
};
```

成功レスポンスは `TownMutationResult`。移動では購入費を消費しない。所有権、境界、開放範囲、衝突、固定地形、道路条件を再検証する。道路と橋は移動不可とし、`PLACEMENT_IMMOVABLE` を返す。

### `deleteRoad(input)`

```ts
type DeleteRoadInput = {
  buildingId: string;
  requestId: string;
};

type DeleteRoadResult = {
  deletionKind: "road" | "bridge";
  deletedBuildingIds: string[];
  deletedRoadStructureId: string | null;
  coinBalance: number;
  population: number;
  updatedAt: string;
};
```

通常道路は指定した 1 セルだけを削除する。橋のセルを指定した場合は同じ `roadStructureId` の 7 セルを一括削除する。どちらも返金しない。削除により既存建物の道路隣接条件が壊れる場合は `ROAD_IN_USE` とし、橋グループが不完全な場合は `BRIDGE_GROUP_INVALID` として部分削除しない。

### `unlockLand(input)`

MVPで正式に実装する。

```ts
type UnlockLandInput = {
  x: number;
  y: number;
  requestId: string;
};
```

`x`、`y` は開放する20×20ブロックの左上アンカー座標とし、20の倍数とする。既存開放領域と上下左右の辺で隣接し、斜め隣接は不可。コストは1000コインとし、残高減算、台帳追加、領域追加を一つのトランザクションで行う。クライアントがコイン・アイテム・必要歩数を指定しない。詳細は [本番Supabase接続Phase0契約決定書.md](./本番Supabase接続Phase0契約決定書.md) §7.4 を正本とする。

### 道路以外の建物削除

仕様が TBD のため API を定義しない。道路と橋の削除だけは `deleteRoad` で扱う。

## 10. 配置ルールの共有

フロントエンドはカタログのサイズと取得済み街データから事前プレビューできる。ただし次の最終判定は常にサーバーが行う。

```text
矩形が 100×100 内
  AND 全セルが開放済み
  AND 全セルが未占有
  AND 障害物と非衝突
  AND 固定地形の配置ルールを満たす
  AND 道路ルールを満たす
  AND コインが十分
```

道路の周辺定義は上下左右の4方向とし、斜めは含めない。
通常道路と既存の通常道路の重複セルは「未占有」条件の例外とし、新規配置・課金の対象から除外する。

## 11. API 契約テスト

- カタログに 1×1 と 2×2 が正しい型で含まれる。
- 各建物の構造化効果と重複ルールがカタログで返る。
- 未知の効果タイプを含むレスポンスをフロントが読み込める。
- 自分の街だけ `coins` が返る。
- 公開街に歩数、コイン、Google 連携情報が含まれない。
- 歩数同期の再送で二重付与されない。
- 2×2 建物の境界・衝突エラーコードが一致する。
- 同じ `requestId` の配置再送で二重購入されない。
- 他ユーザーの配置物を移動できない。
- 川セルへ通常建物を配置できない。
- 川の直線部を横断する 7 セルだけが橋になり、川の曲がり角や平行方向では拒否される。
- 橋の価格が `5 * 200 + 2 * 通常道路価格` になる。
- 道路と橋を移動できない。
- 通常道路は 1 セルだけ削除され、橋は 7 セルが同じトランザクションで削除される。
- 道路削除で既存建物の道路条件を壊す場合は削除されない。
- 橋削除の再送で部分削除や二重処理が起きない。
- ランキング人口と街詳細人口が一致する。

## 12. 変更管理

- API 型はフロントエンドとバックエンドで共有するか、自動生成することが望ましい。
- 破壊的変更では型または関数のバージョンを上げる。
- 建物価格・効果値の変更はカタログのバージョンを上げる。
- 未確定事項が決まったら、この文書、バックエンド設計書、該当テストを同時に更新する。

## 13. 未確定事項

- Google Health API と必要スコープ
- ユーザーがタイムゾーンを変更した場合の過去歩数再集計ルール（初期リリースの日付境界は `Asia/Tokyo` 固定）
- 全建物のコスト
- 川以外の障害物、道路以外の建物削除
- ランキングの同率・ページング仕様
