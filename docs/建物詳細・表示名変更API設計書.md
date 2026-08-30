# 建物詳細・表示名変更 API 設計書

| 項目 | 内容 |
| --- | --- |
| 対象プロダクト | Walk City |
| ステータス | MVPフロントエンド・mock実装済み、Supabase連携待ち |
| 作成日 | 2026-08-28 |
| 対象機能 | マップ上の建物選択、建物詳細表示、配置済み建物の表示名変更 |
| 関連 API | `getMyTown()` / `getPublicTown()` / `getBuildingCatalog()` / `renameBuilding()` |

## 1. 目的

マップ上の配置済み建物を選択し、表示名、建物種類、座標、サイズ、現在のカタログ価格、人口効果および効果説明を表示する。

また、街の所有者が配置済み建物ごとにカスタム表示名を設定し、カタログの初期名へ戻せるようにする。

本書はバックエンドへの影響を抑えたMVP契約を定義する。建物効果の実効値を計算する専用APIは作らず、既存の街データとカタログを組み合わせて詳細を表示する。

## 2. MVPの範囲

### 2.1 実装するもの

- 自分の街と公開街で建物をクリックして選択する。
- 選択中の建物をマップ上で強調する。
- 既存の `TownDetail` と `BuildingCatalogItem` から詳細を表示する。
- 自分の街の配置済み建物へカスタム名を設定する。
- カスタム名を削除してカタログの初期名へ戻す。
- 名前変更後、街全体を再取得せず対象建物だけ更新する。

### 2.2 MVPでは実装しないもの

- `getBuildingDetail()` のような専用詳細API
- 公園、病院、役所などの現在の実効人口計算
- `populationDeltaIfRemoved`
- 建物効果の重複上限判定
- 建物の移動、削除、売却
- 表示名変更時の楽観的ロックと専用冪等性台帳

これらは建物効果のバックエンド仕様が確定した後の拡張とする。

## 3. データ契約

### 3.1 `PlacedBuilding`

既存の配置済み建物へ `customName` を追加する。

```ts
type PlacedBuilding = {
  id: string
  buildingTypeCode: string
  customName: string | null
  anchorX: number
  anchorY: number
  createdAt: string
  updatedAt: string
}
```

表示名は次の規則で解決する。

```ts
const displayName = building.customName ?? catalogItem.name
```

解決済みの `displayName` はAPIレスポンスへ追加しない。フロントエンドは同時に取得済みの建物カタログから初期名を得る。

### 3.2 DB変更

Supabaseの `placed_buildings` へ次の列を追加する。

| 列 | 型 | NULL | 内容 |
| --- | --- | --- | --- |
| `custom_name` | `text` | 可 | 配置済み建物の個別名。`NULL` はカタログ初期名を使用 |

推奨制約:

```sql
CHECK (
  custom_name IS NULL
  OR (
    char_length(custom_name) BETWEEN 1 AND 30
    AND custom_name = btrim(custom_name)
  )
)
```

改行と制御文字は名前変更用DB Functionでも拒否する。クライアントから `placed_buildings` を直接更新せず、所有権を検証するRPCを使用する。

### 3.3 既存街取得API

`getMyTown()` と `getPublicTown()` が返す `TownDetail.buildings[]` に `customName` を含める。

- 自分の街では名前の閲覧と変更ができる。
- 公開街では名前の閲覧だけができる。
- カスタム名は公開街にも表示される公開情報として扱う。
- 街のコイン、歩数、Health連携状態などの非公開情報は従来どおり公開街へ含めない。

## 4. 建物詳細表示

### 4.1 API呼び出し

建物の選択、選択解除、詳細パネル表示のために新しいAPIは呼ばない。

表示には次を使用する。

| 表示項目 | 取得元 |
| --- | --- |
| カスタム名 | `PlacedBuilding.customName` |
| 初期名 | `BuildingCatalogItem.name` |
| 建物種類 | `BuildingCatalogItem.category` |
| サイズ | `BuildingCatalogItem.width`, `height` |
| 座標 | `PlacedBuilding.anchorX`, `anchorY` |
| 現在の価格 | `BuildingCatalogItem.costCoins` |
| 人口効果 | `effects` 内の `population_flat` の合計 |
| 効果説明 | `BuildingCatalogItem.effects[].description` |
| 効果がない場合の説明 | `BuildingCatalogItem.description` |

現在の価格はカタログ価格であり、購入時に支払った価格ではない。

### 4.2 人口と効果の表示範囲

MVPでは、カタログに設定された固定効果だけを表示する。

```ts
const populationEffect = item.effects
  .filter((effect) => effect.type === 'population_flat')
  .reduce((total, effect) => total + (effect.value ?? 0), 0)
```

- 住宅（小）は `+10人`、住宅（大）は `+50人` と表示する。
- カタログに人口固定効果がない建物は「なし」と表示する。
- 公園の位置依存効果や、病院の住宅数に応じた効果はMVPで独自計算しない。
- 未知の効果タイプは数値計算せず、サーバーが返す説明文だけ表示する。

## 5. 名前変更API

### 5.1 `renameBuilding(input)`

```ts
type RenameBuildingInput = {
  buildingId: string
  customName: string | null
}

type RenameBuildingResult = {
  building: PlacedBuilding
  updatedAt: string
}

interface TownApi {
  renameBuilding(
    input: RenameBuildingInput,
  ): Promise<ApiResult<RenameBuildingResult>>
}
```

`customName: null` は、個別名を削除してカタログ初期名へ戻す操作とする。

クライアントから次を送らない。

- `townId`
- `userId`
- カタログの初期名
- 人口
- コイン
- 建物効果

対象の街と所有者は、認証済みJWTと `buildingId` からバックエンドが検証する。

### 5.2 名前のルール

- 前後の空白を除いた1〜30 Unicodeコードポイントとする。
- 空文字列と空白だけの名前を拒否する。
- 改行、タブ、NULL文字、その他の制御文字を拒否する。
- 日本語、英数字、一般的な記号、絵文字を許可する。
- HTMLやMarkdownとして解釈せず、常にプレーンテキストで表示する。
- 同じ街に同名の建物が複数存在してもよい。
- カタログ初期名と同じ名前は `customName: null` として保存する。
- 不適切表現の自動検出はMVPの対象外とする。

フロントエンドも同じ規則で事前検証するが、最終判定はバックエンドが行う。

### 5.3 バックエンド処理

1. JWTから認証ユーザーを特定する。
2. `buildingId` と `customName` を検証する。
3. 対象建物と所属する街を取得する。
4. 認証ユーザーが街の所有者であることを確認する。
5. 文字列の場合は前後空白を除去し、名前ルールを検証する。
6. カタログ初期名と同じ場合、または `null` の場合は `custom_name = NULL` にする。
7. `custom_name` と `placed_buildings.updated_at` を更新する。
8. 更新後の `PlacedBuilding` を返す。

名前変更は同じ値を設定する処理なので、同じリクエストが再送されても人口やコインのような累積更新は発生しない。MVPでは専用の `requestId` と冪等性台帳を追加しない。

### 5.4 名前変更で更新しないもの

- コイン残高
- 人口
- コイン台帳
- 建物種類
- 配置座標
- 建物効果
- 建物の作成日時

人口やコインの再計算は行わない。

## 6. 認証とエラー

| 操作 | 自分の街 | 公開街 |
| --- | --- | --- |
| 建物選択・詳細表示 | 可 | 可 |
| カスタム名表示 | 可 | 可 |
| 名前変更 | 可 | 不可 |

MVPでは既存の共通エラーコードを使用する。

| code | 条件 |
| --- | --- |
| `UNAUTHENTICATED` | 有効なセッションがない |
| `INVALID_INPUT` | 建物ID、名前の長さ、名前の文字が不正 |
| `NOT_OWNER` | 他ユーザーの建物を変更しようとした |
| `NOT_FOUND` | 対象建物またはカタログ項目がない |
| `INTERNAL_ERROR` | 予期しないサーバー障害 |

失敗時は `custom_name` と `updated_at` を部分更新しない。

## 7. フロントエンド動作

### 7.1 選択

- マップのクリック座標から占有している `PlacedBuilding` を特定する。
- 2×2建物はどの占有セルをクリックしても同じ建物を選択する。
- 選択した建物を黄色い枠線で強調する。
- 空いているセルをクリックすると選択を解除する。
- マップのパン操作後は建物を選択しない。
- 配置、道路作成、土地開放中は建物選択を行わない。

### 7.2 詳細パネル

- 表示名、初期名、種類、サイズ、座標、現在価格、人口固定効果、効果説明を表示する。
- カスタム名がある場合は建物種類の初期名も併記する。
- 公開街では名前編集フォームを表示しない。
- 詳細パネルを閉じると選択を解除する。

### 7.3 名前変更

- 保存中は入力欄とボタンを無効化する。
- 成功時は `TownDetail.buildings` の対象建物だけを差し替える。
- 成功後に街全体を再取得しない。
- 成功通知を表示する。
- 失敗時は入力値を保持してエラーを表示する。
- 「初期名に戻す」は `customName: null` を送信する。

## 8. mock実装

実バックエンドが完成するまで、mockの `TownApi` が同じ `renameBuilding()` 契約を実装する。

- mockの全配置済み建物は初期値 `customName: null` とする。
- 名前変更時に所有権、建物存在、カタログ存在、名前ルールを検証する。
- mockの街スナップショットへ変更を保存する。
- 名前変更前後でコイン、人口、座標、効果を変更しない。
- `reset()` で初期名へ戻る。

SupabaseモードのTown APIは現時点で準備中のため、`renameBuilding()` も他の街更新APIと同じ準備中エラーを返す。

## 9. 受け入れテスト

### 詳細表示

- 1×1建物をクリックして詳細を表示できる。
- 2×2建物の任意の占有セルから詳細を表示できる。
- 選択中の建物だけ強調される。
- 表示名、種類、サイズ、座標、価格、人口固定効果、効果説明が正しい。
- 公開街でも詳細を表示できる。
- 公開街では名前編集フォームを表示しない。

### 名前変更

- 所有者が1〜30文字の名前へ変更できる。
- 前後空白が除去される。
- 空文字、空白のみ、31文字以上、改行、制御文字を拒否する。
- 同名の建物を許可する。
- `customName: null` で初期名へ戻せる。
- 初期名と同じ名前は `customName: null` になる。
- 名前変更後にマップと詳細パネルの表示名が同時に変わる。
- 名前変更前後でコイン、人口、座標、効果が変わらない。
- HTML風の文字列を設定してもプレーンテキストとして表示される。

## 10. バックエンドの最小変更

バックエンド担当に必要な変更は次の範囲とする。

1. `placed_buildings.custom_name` のnullable列を追加する。
2. 街取得レスポンスの `PlacedBuilding` へ `customName` を追加する。
3. 所有権と名前を検証する `renameBuilding()` RPCを追加する。
4. API型、RLSまたはRPC認可テストを更新する。

人口再計算、コイン計算、建物効果計算、専用詳細APIは変更しない。

## 11. 将来拡張

建物効果のバックエンド実装後、必要に応じて次を別契約として追加する。

- `getBuildingDetail()`
- 現在有効な効果と無効理由
- `populationDeltaIfRemoved`
- 公園の隣接住宅数
- 名前変更の `expectedUpdatedAt` による楽観的ロック
- 名前変更の `requestId` と冪等性台帳
- リアルタイム名前更新
