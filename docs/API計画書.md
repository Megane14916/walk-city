# 散歩×街づくりゲーム 共有API・データ契約書

## 1. 目的

フロントエンドとバックエンドを別担当者が並行開発できるように、画面が利用するデータ、操作、エラー形式を固定する。

この契約書を変更するときは、必ず両担当者が合意し、変更履歴を残す。

## 2. MVPの前提

- Webアプリケーション、スマートフォン優先
- 歩数は手入力
- 1日3,000歩以上で「散歩1回」と判定
- 週間目標は3回、未達ペナルティなし
- 段階報酬は1,000歩、3,000歩、5,000歩、8,000歩
- 街は20×20マス、中央10×10から開始
- 見下ろし型ドット絵、グリッドへの自由配置
- 木と池は固定障害物
- 人口は配置済み建物の人口ポイント合計
- 他ユーザーの街を訪問できる
- 1ユーザーにつき各街へ1回いいねできる
- 総人口と今週増えた人口をランキング表示
- 建物の売却、回転、複数マス建物はMVP対象外

## 3. 共通ルール

### 日付と週

- 日付判定のタイムゾーンは `Asia/Tokyo` に統一する
- 週は月曜日00:00から日曜日23:59までとする
- 日付は `YYYY-MM-DD` 形式で返す
- 日時はISO 8601形式で返す

### 座標

- 左上を `(0, 0)` とする
- `x` は右方向、`y` は下方向
- 有効範囲は `0 <= x < 20`、`0 <= y < 20`
- 木・池・ロック中マス・配置済みマスには建築できない

### 数値の管理

- コイン、人口、報酬獲得状態はバックエンドを正とする
- フロントエンドは表示用に予測してよいが、成功レスポンスで必ず置き換える
- 報酬額や建物効果はバックエンドの設定値を利用し、両側へ別々にハードコードしない

## 4. 共通レスポンス形式

成功:

```json
{
  "data": {}
}
```

失敗:

```json
{
  "error": {
    "code": "INSUFFICIENT_COINS",
    "message": "コインが不足しています",
    "details": {}
  }
}
```

主なエラーコード:

| コード | 用途 |
|---|---|
| `UNAUTHORIZED` | 未ログイン |
| `INVALID_INPUT` | 入力値不正 |
| `ALREADY_CLAIMED` | 報酬取得済み |
| `REWARD_NOT_REACHED` | 必要歩数未達 |
| `INSUFFICIENT_COINS` | コイン不足 |
| `BUILDING_LOCKED` | 建物未解放 |
| `CELL_LOCKED` | 土地未開放 |
| `CELL_OCCUPIED` | 木・池・建物と衝突 |
| `NOT_OWNER` | 他人のデータを変更しようとした |
| `ALREADY_LIKED` | いいね済み |
| `CANNOT_LIKE_SELF` | 自分の街へのいいね |
| `NOT_FOUND` | 対象なし |

## 5. 主要データ型

### UserSummary

```json
{
  "id": "user-uuid",
  "displayName": "さくら",
  "townName": "ひだまり村",
  "coins": 250,
  "population": 35,
  "weeklyWalkCount": 2,
  "weeklyGoal": 3
}
```

### WalkStatus

```json
{
  "date": "2026-08-23",
  "steps": 5200,
  "qualifiedAsWalk": true,
  "claimedTiers": [1000, 3000],
  "availableTiers": [5000],
  "nextTier": 8000
}
```

### RewardTier

値は仮設定。初日の結合前に確定する。

```json
{
  "steps": 3000,
  "coins": 100,
  "buildingTickets": 0
}
```

### BuildingCatalogItem

```json
{
  "type": "house",
  "name": "民家",
  "costCoins": 100,
  "costTickets": 0,
  "populationValue": 10,
  "requiredPopulation": 0,
  "spriteKey": "house"
}
```

### PlacedBuilding

```json
{
  "id": "building-uuid",
  "type": "house",
  "x": 3,
  "y": 5,
  "populationValue": 10,
  "createdAt": "2026-08-23T12:34:56+09:00"
}
```

### Town

```json
{
  "id": "town-uuid",
  "owner": {
    "id": "user-uuid",
    "displayName": "さくら"
  },
  "name": "ひだまり村",
  "population": 35,
  "weeklyPopulationGrowth": 15,
  "likesCount": 7,
  "likedByMe": false,
  "unlockLevel": 0,
  "buildings": [],
  "terrainVersion": 1,
  "editable": true
}
```

## 6. 操作/API

実装がSupabaseの場合、HTTP APIではなくRPCやSDK呼び出しに置き換えてよい。ただし引数と戻り値はこの契約に合わせる。

### `getCurrentUser()`

- 用途: ヘッダー、ホーム初期表示
- 戻り値: `UserSummary`

### `updateProfile(displayName, townName)`

- 用途: 初回設定、プロフィール変更
- 検証: 空文字禁止、最大文字数を設定
- 戻り値: 更新後の `UserSummary`

### `getTodayWalkStatus()`

- 用途: 今日の歩数と報酬状態の表示
- 戻り値: `WalkStatus`

### `submitSteps(steps)`

- 用途: 今日の歩数入力
- 入力: 0以上100,000以下の整数
- 同日の再送信: 現在値以上のみ許可する
- 戻り値: 更新後の `WalkStatus` と `UserSummary`

### `claimReward(tierSteps)`

- 用途: 段階報酬の受け取り
- 入力例: `{ "tierSteps": 3000 }`
- 処理: 歩数確認、二重取得確認、残高更新を一括実行
- 戻り値: `WalkStatus`、更新後残高、獲得内容

### `getBuildingCatalog()`

- 用途: 建築ショップ
- 戻り値: `BuildingCatalogItem[]`

### `getMyTown()`

- 用途: 自分の街の表示
- 戻り値: `Town`

### `placeBuilding(type, x, y)`

- 用途: 建物購入と配置
- 処理: 解放条件、残高、マス衝突を検証し、支払いと配置を一括実行
- 戻り値: 作成した `PlacedBuilding`、更新後コイン、人口

### `moveBuilding(buildingId, x, y)`

- 用途: 自分の建物の移動
- 処理: 所有権と移動先マスを検証
- 戻り値: 更新後の `PlacedBuilding`

### `getRankings(type)`

- `type`: `population` または `weeklyGrowth`
- 戻り値: 順位、ユーザーID、ユーザー名、街名、人口値の配列
- MVP表示件数: 上位20件

### `getTownByUserId(userId)`

- 用途: 他ユーザーの街を訪問
- 戻り値: `editable: false` の `Town`

### `likeTown(townId)`

- 用途: 街へいいね
- 制約: 自分の街不可、同じ組み合わせは1回のみ
- 戻り値: `likesCount`、`likedByMe`

## 7. 初期建物カタログ案

| type | 表示名 | コイン | 人口 | 解放条件 |
|---|---:|---:|---:|---:|
| `house` | 民家 | 100 | 10 | 最初から |
| `field` | 畑 | 150 | 5 | 最初から |
| `bakery` | パン屋 | 250 | 20 | 人口20 |
| `park` | 公園 | 400 | 30 | 人口50 |
| `townhall` | 役場 | 700 | 50 | 人口100 |

数値はデモバランス確認後に変更可能とする。

## 8. 固定地形

- MVPでは全ユーザーが同じ固定地形を使用する
- 木と池の座標はフロントエンドのバージョン管理されたJSONに置く
- `terrainVersion` が一致しない場合は表示を止め、更新を促す
- 配置APIでも同じ障害物座標を検証する

## 9. 結合テストシナリオ

1. 新規ユーザーを作成する
2. 今日の歩数を3,200歩で登録する
3. 1,000歩と3,000歩報酬を取得する
4. 同じ報酬を再取得し、`ALREADY_CLAIMED` になることを確認する
5. 民家を空きマスへ配置する
6. 同じマスへの配置が `CELL_OCCUPIED` になることを確認する
7. 再読み込み後も民家と残高が保持されることを確認する
8. 別ユーザーから街を訪問する
9. いいねを送り、二重いいねが拒否されることを確認する
10. 人口ランキングへ反映されることを確認する

## 10. 変更履歴

| 日付 | 変更 | 担当 |
|---|---|---|
| 2026-08-23 | 初版 | チーム |
