# Walk City フロントエンド詳細技術設計書

## 1. 概要

### 1.1 目的

本書は、Walk City の React フロントエンドについて、画面、ルーティング、ディレクトリ、コンポーネント、データアクセス、認証、命名の実装規約を定義する。フロントエンド担当と Supabase バックエンド担当が、共通の API 契約をもとに並行開発できる状態を目標とする。

上位仕様は以下の文書を正とする。本書に記載のないゲームルール、API の入出力、エラーコードは上位仕様に従う。

- [フロントエンド設計書](./フロントエンド.md)
- [API 設計書](./API計画書.md)
- [システムアーキテクチャ](./architecture.md)
- [Map 機能 Design Doc](./map機能DesignDoc.md)
- [Google 認証・Google Health 連携機能 Design Doc](./Google認証機能DesignDoc.md)
- [バックエンド設計書](./バックエンド.md)

文書間で差異が生じた場合は、API の型・関数・エラーコードについては `API計画書.md`、フロントエンドの担当範囲については `フロントエンド.md` を優先し、チームで合意したうえで関連文書を同時に更新する。

### 1.2 対象技術

| 区分 | 採用技術・方針 |
|---|---|
| UI | React 19、TypeScript |
| ビルド | Vite |
| スタイル | Tailwind CSS |
| BaaS | Supabase JavaScript Client |
| 認証 | Supabase Auth + Google OAuth |
| バックエンド通信 | Supabase Auth SDK、Edge Functions、RPC、View / Query |
| ルーティング | パスと遷移仕様は本書で固定。ルーティングライブラリは TBD |
| サーバー状態管理 | 取得・再取得ルールは本書で固定。ライブラリは TBD |
| テスト | テスト観点は上位設計に従う。具体的なツールは TBD |
| Map 描画 | 初期実装は React + HTML/CSS。Canvas 化は性能上必要な場合のみ検討 |

ルーティングライブラリとデータ取得ライブラリは、ハッカソン期間とチームの習熟度を踏まえて選定する。各 Page と Hook は特定ライブラリの API を機能コンポーネントへ漏らさず、後から選定・変更できる境界を保つ。

### 1.3 アーキテクチャ方針

```text
Route / Page
    ↓ 画面の組み立て・URL解釈
Feature Component
    ↓ ユーザー操作
Feature Hook
    ↓ ユースケース実行・UI状態管理
Feature Service
    ↓ ApiResult<T> へ正規化
Supabase Client / Mock Service
    ↓
Supabase Auth / Edge Function / RPC / View
```

依存方向は原則として上から下への一方向とする。コンポーネントから Supabase SDK を直接呼ばない。バックエンドが確定するコイン、人口、歩数報酬、建物価格、効果、配置可否、ランキング順位をフロントエンドで独自計算しない。

### 1.4 信頼境界

フロントエンドのローカル判定は、操作性向上のためのプレビューに限定する。次の値と判定は必ずサーバーの応答を正とする。

- 認証ユーザー ID
- Google Health の歩数と同期済み範囲
- コインの付与量・残高
- 建物の価格・サイズ・効果・購入可否
- 配置範囲、衝突、道路条件、所有権
- 人口とランキング順位
- 土地開放状態と開放条件

ブラウザには Supabase の Service Role Key、Google のアクセストークン・更新トークン、OAuth クライアントシークレットを保存しない。

## 2. 実装機能

### 2.1 認証・セッション

- Google ログインの開始
- OAuth 後の Supabase セッション復元
- Auth 状態変更の監視
- ログアウト
- 未認証ユーザーの `/login` への誘導
- 認証済みユーザーが `/login` を開いた場合の `/` への誘導
- Google Health 連携状態の表示、連携開始、再同意、連携解除

Google ログインと Google Health の歩数読み取り認可は分離する。Health 連携を拒否・解除しても、歩数同期以外のログイン済み機能は利用可能とする。ログアウトしても Health 連携は解除しない。

### 2.2 自分の街・ダッシュボード

`/` は、既存設計の「ホーム画面」と「街づくり画面」を一つのメイン画面として構成する。

- ユーザー名、街名
- 今日の歩数、最終同期日時
- Google Health 接続状態
- 所持コイン、人口
- 歩数同期と同期結果
- 自分の街の Map
- 建物・道路カタログ
- 建物の価格、サイズ、効果、購入可否
- 購入配置、配置済み建物の移動
- ランキングへの導線

歩数同期ではクライアントから歩数、コイン、ユーザー ID を送らず、`syncSteps()` の成功レスポンスを表示へ反映する。二重クリックを防止し、結果不明時に成功と推測しない。

### 2.3 Map 表示・編集

- 最大 100×100 セルの Map 表示
- 初期 20×20 を含む開放済み領域と未開放領域の区別
- 1×1 / 2×2 の建物・道路・障害物の描画
- パン、ズーム、初期表示位置への復帰
- 建物選択、配置候補セル、占有範囲、配置可否のプレビュー
- 確認操作を挟んだ購入配置
- 配置済み建物の移動
- 通信中の二重送信防止
- 競合時の街データ再取得
- `editable: false` の街を閲覧専用で表示

Map 座標は左上を原点 `(0, 0)` とし、`x` は右、`y` は下へ増加する。2×2 建物の座標は左上セルをアンカーとする。回転、建物削除、仕様確定前の土地開放操作は実装しない。

初期描画は 1 万セルを個別 DOM 要素にせず、グリッドを CSS 背景、建物・開放領域・障害物・プレビューを要素として描画する。基準セルサイズは 32 px、ズーム範囲は 0.5〜2.0 とする。

### 2.4 ランキング・ユーザー閲覧

- 全ユーザーの人口ランキング
- 順位、表示名、街名、人口
- 自分の順位の識別
- カーソルベースの追加取得に対応できる表示構造
- ランキング項目からユーザーページへの遷移
- ユーザーページから対象ユーザーの街への遷移
- 他ユーザーの街の閲覧専用表示

他ユーザーの街にはコイン、歩数、Google Health 接続情報を表示しない。`/town/:userId` の URL パラメータは公開街の取得対象にのみ使用し、更新 API の所有者指定には使用しない。

### 2.5 共通 UI 状態

全画面で以下を明示的に扱う。

- 初期ローディング
- 部分更新中
- データなしの空状態
- 入力・配置の検証エラー
- 認証切れ
- 通信失敗と再試行
- 存在しないユーザー・街
- 想定外エラーの一般メッセージ

エラー表示に SQL、内部スタック、トークン、内部用 ID などを露出しない。API の `message` を表示候補とし、UI の分岐は安定した `code` で行う。

### 2.6 モック開発

バックエンドとの並行開発のため、実サービスと同じ関数シグネチャ・`ApiResult<T>` を実装するモックを用意する。

- 未ログイン、ログイン済み、初回ユーザー
- Health 未連携、接続済み、権限不足、外部 API 失敗
- 歩数未同期、同期成功、再同期
- コイン不足
- 1×1 / 2×2 の配置・移動成功
- Map 外、未開放、衝突、道路条件未達
- ランキング、空ランキング、他ユーザーの街
- 疑似遅延と操作単位のエラー注入

環境変数または Provider の生成時に実サービスとモックを切り替える。コンポーネント内で `if (mock)` の分岐を持たない。

### 2.7 初期スコープ外

以下は仕様が確定するまで UI または確定ロジックを実装しない。

- 建物の回転・削除・売却
- 土地開放の確定 UI
- 障害物のゲームルール
- 道路隣接の独自判定
- 建物価格や歩数報酬式のハードコード
- 役所効果の適用範囲・重複計算
- 商業施設・工場のボーナス計算

## 3. 画面一覧

| Page | URL | 役割 | 主な取得データ | 主な操作 |
|---|---|---|---|---|
| `LoginPage` | `/login` | Google ログインと認証状態の表示 | 認証・Health 連携状態 | Google ログイン開始 |
| `TownPage`（自分） | `/` | 自分の街、ダッシュボード、街編集 | Dashboard、自分の Town、カタログ | 歩数同期、Health 連携、配置、移動 |
| `TownPage`（訪問） | `/town/:userId` | 他ユーザーの街の閲覧 | 公開 Town、必要なカタログ | パン、ズーム、ユーザーページへ遷移 |
| `RankingPage` | `/ranking` | 人口ランキング | RankingPage | 追加取得、ユーザー選択 |
| `UserPage` | `/users/:userId` | 対象ユーザーの公開情報と街への導線 | 公開 API で取得可能な User / Town 要約 | 対象ユーザーの街を訪問 |

### 3.1 `LoginPage`

表示状態は `checkingSession`、`signedOut`、`redirectingToGoogle`、`error` を区別する。セッション確認中はログインボタンを表示せず、認証済みであれば `/` へ置換遷移する。ログインボタンの連打を防ぎ、OAuth キャンセル時は再試行を提示する。

Google Health 連携はログインとは別操作であるため、ログインボタンから Health の追加スコープを要求しない。

### 3.2 `TownPage`（自分の街）

画面は次の領域を持つ。

1. 共通ヘッダー: ユーザー、ナビゲーション、ログアウト
2. ダッシュボード: 歩数、最終同期、コイン、人口、Health 接続状態
3. Map Viewport: 開放領域、建物、プレビュー、パン・ズーム
4. 建物ショップ: カタログ、価格、効果、選択状態
5. 操作パネル: 選択項目、座標、配置可否、確定・キャンセル
6. フィードバック: 同期結果、配置結果、エラー、再試行

PC では Map とショップを横並び、スマートフォンでは Map の下にショップをドロワーまたはパネルとして配置する。Map の確定操作は送信中に無効化する。パンとズームは継続可能としてよい。

### 3.3 `TownPage`（他ユーザーの街）

自分の街と同じ `TownMap` を使用し、`TownDetail.editable === false` を閲覧モードの入力とする。ショップ、購入、配置、移動、土地開放操作を描画しない。URL 上の `userId` が自分自身の場合は `/` へ置換遷移し、編集可能画面を一つに統一する。

`editable` は UI 制御の値であり、認可の根拠ではない。URL やクライアント状態を改変しても他ユーザーの街を更新できないよう、バックエンドの JWT・所有権検証を前提とする。

### 3.4 `RankingPage`

初回取得、空状態、追加取得中、追加取得失敗を別々に表示する。`nextCursor` が `null` の場合は追加取得を終了する。各項目はユーザーページ `/users/:userId` へ遷移でき、自分の項目は `isCurrentUser` を用いて視覚的・テキスト的に識別する。

同率順位、1回の取得上限、カーソル形式は API 仕様確定まで画面側で仮定しない。

### 3.5 `UserPage`

初期版では、公開 API から取得できる表示名、街名、人口などの要約と「街を訪問」導線を表示する。プロフィールの追加項目は仕様・API が確定してから拡張する。専用 API が未定の間、取得可能な公開街データから表示できる範囲を超えて、フロントエンド独自のプロフィールデータを作らない。

対象が存在しない場合は `ErrorMessage` で案内し、ランキングへ戻る導線を提供する。

## 4. ルーティング設計

### 4.1 ルート定義

| Path | Page | 認証 | データモード | 備考 |
|---|---|---|---|---|
| `/` | `TownPage` | 必須 | `self` | 自分の街・メイン画面 |
| `/login` | `LoginPage` | 不要 | `guest` | 認証済みなら `/` へ置換遷移 |
| `/town/:userId` | `TownPage` | 必須 | `public` | 他ユーザーの街。自分の ID なら `/` へ置換遷移 |
| `/ranking` | `RankingPage` | 必須 | `ranking` | 全ユーザー人口ランキング |
| `/users/:userId` | `UserPage` | 必須 | `publicUser` | ユーザーページ |

初期版ではゲーム画面を認証必須とする。「公開街」は他ユーザーへ公開してよいデータ範囲を意味し、匿名公開を意味しない。匿名閲覧を追加する場合は RLS、API、ルートガードを同時に見直す。

### 4.2 ルートガード

```text
アプリ起動
  ↓
セッション確認中？
  ├─ YES → 全画面ローディング
  └─ NO
      ↓
      現在のパスは /login？
      ├─ YES
      │   ├─ ログイン済み → / へ replace
      │   └─ 未ログイン   → LoginPage
      └─ NO
          ├─ ログイン済み → 対象 Page
          └─ 未ログイン   → /login へ replace
```

指定されたエントリーフローは次のとおりとなる。

```text
/
↓
ログイン済み？
├─ YES → 自分の街
└─ NO  → /login
```

ガード判定は `auth` feature が公開する認証状態を使用する。Page ごとに `getSession()` を重複実行しない。セッション確認前に未認証と決めつけて `/login` へ遷移すると、リロード時に画面がちらつくため、`initializing` 状態を必ず設ける。

### 4.3 `router.tsx` の責務

- 上記 Path と Page の対応付け
- 認証必須レイアウトまたは Guard の適用
- URL パラメータの受け渡し
- 未定義 URL のエラー表示または `/` への誘導
- ルート単位の遅延読み込みを採用する場合の境界

`router.tsx` はデータ取得、Supabase 呼び出し、ゲームロジックを持たない。ルーティングライブラリ選定後も、Path 文字列はこのファイルに集約し、機能コンポーネントに散在させない。リンク生成用の関数または定数を用意し、`/town/${id}` の手書きを減らす。

### 4.4 Page のモード決定

`TownPage` はルートに応じて次のように動作する。

```ts
type TownPageMode =
  | { type: 'self' }
  | { type: 'public'; userId: string }
```

- `/`: `getMyTown()` を使用し、`editable: true` のときだけ編集 UI を表示する。
- `/town/:userId`: `getPublicTown(userId)` を使用し、常に閲覧用 UI として扱う。
- `userId` は空文字を許容せず、不正な形式は `INVALID_INPUT` 相当の画面エラーとして扱う。
- ルート変更時は前の街のデータを新しい街として表示しない。

### 4.5 OAuth コールバック

Google 認証設計で使用する `/auth/callback` は、ユーザー向け画面ではなく OAuth 結果を処理する技術パスである。採用する Supabase のフローによって、次のどちらかを実装時に選定する。

- Supabase SDK がリダイレクト先でセッションを復元できる場合は、登録済みのアプリ URL で復元後 `/` へ遷移する。
- 専用パスが必要な場合は `/auth/callback` をシステムルートとして追加し、セッション交換・復元後に `/` または安全な保存済み遷移先へ置換遷移する。

このパスではトークンや認可コードをログへ出さない。Google Health の Callback は Edge Function が担当し、React の画面ルートでは処理しない。

### 4.6 遷移ルール

- ログイン成功: `/` へ `replace`
- ログアウト成功: `/login` へ `replace`
- 認証切れ: 編集・同期を停止し `/login` へ誘導
- ランキング項目選択: `/users/:userId`
- ユーザーページの「街を訪問」: `/town/:userId`
- 他ユーザー街で自分の `userId` を検出: `/` へ `replace`
- 存在しないユーザー・街: URL は維持し、ページ内エラーと戻る導線を表示

## 5. ディレクトリ構成

最終的な構成は以下を基準とする。ファイル名は実装に合わせて変更可能だが、責務の配置規則は維持する。`types/` にはアプリ全体で共有する型だけを置き、特定機能だけで使う型は各 `features/<feature>/types.ts` に置く。

```text
frontend/src/
├── app/
│   ├── routes/
│   │   ├── LoginPage.tsx
│   │   ├── TownPage.tsx
│   │   ├── RankingPage.tsx
│   │   └── UserPage.tsx
│   │
│   ├── router.tsx
│   ├── App.tsx
│   └── providers/
│
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginButton.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── services/
│   │   │   └── auth.ts
│   │   └── types.ts
│   │
│   ├── health/
│   │   ├── components/
│   │   │   ├── StepCounter.tsx
│   │   │   └── StepRewardCard.tsx
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   │
│   ├── town/
│   │   ├── components/
│   │   │   ├── TownMap.tsx
│   │   │   ├── BuildingCard.tsx
│   │   │   └── BuildingModal.tsx
│   │   ├── hooks/
│   │   ├── services/
│   │   │   └── town.ts
│   │   └── types.ts
│   │
│   └── ranking/
│       ├── components/
│       │   ├── RankingList.tsx
│       │   └── RankingItem.tsx
│       ├── hooks/
│       ├── services/
│       └── types.ts
│
├── components/
│   ├── Button.tsx
│   ├── Modal.tsx
│   ├── Header.tsx
│   ├── LoadingSpinner.tsx
│   └── ErrorMessage.tsx
│
├── lib/
│   ├── supabase.ts
│   └── api-error.ts
│
├── mocks/
│   ├── data/
│   │   ├── users.ts
│   │   ├── towns.ts
│   │   ├── rankings.ts
│   │   └── health.ts
│   │
│   └── services/
│       ├── auth.ts
│       ├── town.ts
│       ├── ranking.ts
│       └── health.ts
│
├── types/
│   ├── user.ts
│   └── common.ts
│
└── assets/
```

現在の `features/auth/api/` は認証・Health 連携の API 境界とモックを先行実装している。最終構成へ移行するときは、公開インターフェースを保ちながら、本番実装を `features/auth/services/`、モック実装を `mocks/services/`、機能ローカル型を `features/auth/types.ts` へ整理する。一度に移動する必要がある場合は import 更新を同一変更内で行い、中間状態で二重の型定義を作らない。

## 6. 各ディレクトリの責務

### 6.1 `app/`

アプリケーションの組み立てを担当する。機能固有の表示・通信ロジックは置かない。

| 配置先 | 責務 |
|---|---|
| `app/App.tsx` | アプリのルート要素。Router と Provider 群を組み合わせる |
| `app/router.tsx` | Path、Page、Guard、未定義ルートを定義する |
| `app/routes/` | URL 単位の Page。URL 解釈、機能 UI の配置、画面レベルの状態を担当する |
| `app/providers/` | Auth、API 実装、サーバー状態ライブラリ、エラー境界などの Provider を構成する |

Page は薄く保ち、Map の座標計算や API 正規化を実装しない。複数 feature を組み合わせる画面レベルの判断のみを持つ。

### 6.2 `features/`

ユーザー価値またはドメイン機能ごとに、UI、Hook、Service、型を閉じ込める。

| Feature | 責務 |
|---|---|
| `auth/` | Supabase セッション、Google ログイン、ログアウト、Health 接続状態の認証側管理 |
| `health/` | 歩数、同期、報酬結果、Health 連携 UI |
| `town/` | 街取得、カタログ、Map 描画、配置プレビュー、購入配置、移動、公開街閲覧 |
| `ranking/` | ランキング取得、カーソル、一覧・項目表示 |

各 feature 内の配置規則:

- `components/`: その feature 固有の表示と操作
- `hooks/`: UI と Service を接続する状態・ユースケース
- `services/`: Supabase / Edge Function / RPC / View 呼び出しを機能単位の関数へ変換
- `types.ts`: その feature 内だけで使用する Props 以外の型、UI 状態、サービス固有型

feature 間の直接依存は最小化する。たとえば `town` が `health` の内部コンポーネントを直接参照せず、`TownPage` が両者を組み合わせる。共通化が必要なデータ型だけを `types/` に昇格する。

### 6.3 `components/`

複数 feature で再利用する、ドメイン非依存の UI を置く。

- `Button`: 見た目、disabled、loading、アクセシブル名
- `Modal`: フォーカス管理、Esc、背景操作抑止
- `Header`: 共通ナビゲーション枠。認証データ取得自体は行わない
- `LoadingSpinner`: 読み込み状態の表現
- `ErrorMessage`: 一般エラーと再試行アクション

「建物カード」「ランキング項目」のようにドメイン語を含むものは共通 `components/` へ置かず、対応 feature に置く。

### 6.4 `lib/`

アプリ全体で一つだけ持つ技術基盤を置く。

- `supabase.ts`: 環境変数の検証、Supabase Client の生成・公開
- `api-error.ts`: SDK / Edge Function / RPC のエラーを `ApiResult<T>` の共通エラーへ変換する純粋関数

`lib/` は UI、React Hook、機能固有の状態を持たない。Service Role Key を参照するコードは置かない。

### 6.5 `mocks/`

実 API と同じ公開インターフェースを満たす、フロントエンド開発・テスト用実装を置く。

- `data/`: シナリオの初期データ。コンポーネントから直接 import しない
- `services/`: 疑似遅延、状態変化、成功・失敗を再現する Service 実装

モックデータは API 契約と同じ型を使用し、画面の都合だけのフィールドを追加しない。モックだけ成功する呼び出し方法を作らない。

### 6.6 `types/`

2つ以上の feature またはアプリ全体で共有する契約型だけを置く。

- `user.ts`: `UserSummary` など、認証・街・ランキングで共有するユーザー型
- `common.ts`: `ApiResult<T>`、`ApiErrorCode` など全 Service で共有する型

`TownDetail`、`PlacementPreviewStatus`、`MapMode` のように town だけで使う型は `features/town/types.ts` に置く。将来使う可能性だけを理由に共有型へ移動しない。

### 6.7 `assets/`

ビルド対象の画像、アイコン、フォントなどを置く。建物画像は API の `assetKey` とフロントエンドのアセット定義を対応付ける。未知の `assetKey` または読み込み失敗時は、建物名を含む共通プレースホルダーを表示する。

## 7. コンポーネント設計ルール

### 7.1 レイヤーごとのルール

1. Page は URL、Guard 結果、画面レイアウトを扱う。
2. Feature Component は表示とユーザーイベントを扱う。
3. Hook は非同期処理、画面内状態、Service 呼び出しを扱う。
4. Service は通信方式を隠し、共通の戻り値へ正規化する。
5. 純粋な座標計算・整形処理は React から分離し、Hook または feature 内の純粋関数としてテスト可能にする。

### 7.2 Props と状態

- Props は必要最小限とし、画面全体の巨大な状態オブジェクトを渡さない。
- 表示専用コンポーネントはデータと callback を Props で受け取る。
- `onPlace`、`onRetry` のように親へ通知する callback は `on` で始める。
- コンポーネント内のイベント処理関数は `handlePlace`、`handleRetry` のように `handle` で始める。
- boolean Props は `isLoading`、`isEditable`、`hasNextPage`、`canSubmit` のように状態が分かる名前にする。
- API から取得したサーバー状態と、選択・モーダル・パンなどの一時 UI 状態を同じ state に混在させない。
- コイン、人口、歩数報酬を子コンポーネントで再計算しない。

### 7.3 非同期 UI

各非同期処理は最低限、`idle`、`loading/submitting`、`success`、`error` を区別する。初回読み込みと更新中を分け、更新中に古い値を表示する場合は更新中であることを示す。

更新ボタンは送信中に無効化する。タイムアウトなど結果不明の更新ではローカルで成功扱いせず、同じ `requestId` で再送するか、対象データを再取得する。

### 7.4 Map コンポーネント

`TownMap` は少なくとも次の入力を受ける表示・操作境界とする。

```ts
type TownMapProps = {
  town: TownDetail
  catalog: BuildingCatalogItem[]
  mode: MapMode
  onSelectCell?: (cell: Cell) => void
  onSelectBuilding?: (buildingId: string) => void
  onCancel?: () => void
}
```

- `town.editable === false` では編集 callback が渡されても確定 UI を表示しない。
- Map の変換は `translate(panX, panY) scale(zoom)` を一つの Surface に適用する。
- ポインター座標は Viewport、pan、zoom、cellSize を用いて整数セルへ変換する。
- ポインター移動が閾値を超えた場合はパンとみなし、セル選択を発火しない。
- 配置候補の占有セルはカタログの `width` / `height` から求める。
- 移動プレビュー時は移動対象自身を衝突索引から除外する。
- 配置物が多い場合は `"x:y"` をキーにした占有索引をメモ化する。
- `MapBuilding` 相当の要素は入力が変わらない限り再描画を抑制する。

配置プレビューは次の三値を使用する。

```ts
type PlacementPreviewStatus =
  | { status: 'valid' }
  | { status: 'invalid'; reason: PreviewInvalidReason }
  | { status: 'unknown'; message: string }
```

取得済みデータで確定できる Map 内、開放済み、非衝突、カタログ有効、価格設定済み、表示残高の条件だけをローカル判定する。道路条件など未確定の規則は `unknown` としてサーバー確認を許可する。`valid` はサーバー成功を保証しない。

### 7.5 編集状態

購入配置と移動は判別可能な Union で管理し、不可能な状態の組み合わせを作らない。

```ts
type MapMode =
  | { type: 'idle' }
  | {
      type: 'placing'
      item: BuildingCatalogItem
      anchor: Cell | null
      requestId: string
    }
  | {
      type: 'moving'
      buildingId: string
      anchor: Cell | null
      requestId: string
    }
  | { type: 'submitting'; operation: 'place' | 'move' }
```

操作開始時に UUID の `requestId` を生成し、通信失敗による同じ操作の再送では再利用する。キャンセル後の新規操作では新しい UUID を生成する。

### 7.6 アクセシビリティ

- マウス・タッチ操作だけでなく、ボタンでもズームを提供する。
- 配置・移動は必ず確認ボタンを持ち、セル選択だけで購入しない。
- 配置可否、未開放、エラーを色だけで表現しない。
- 建物画像には建物名をアクセシブル名として与える。
- Modal は初期フォーカス、フォーカストラップ、閉じた後のフォーカス復帰を行う。
- `Esc` で配置・移動・Modal をキャンセルできる。ただし送信済み処理を取り消したように見せない。
- ローディングや同期結果は必要に応じて `aria-live` で通知する。

### 7.7 共通化の基準

見た目が似ているだけでは共通化しない。2つ以上の feature で、意味と Props が安定して一致するときに `components/` へ移す。過度に汎用的な `Card` や多数の boolean Props を持つ万能コンポーネントを避け、feature 固有の語彙を保つ。

## 8. データアクセス方針

### 8.1 基本原則

- コンポーネントから Supabase SDK を直接呼ばない。
- Service は通信方式の違いを隠し、`Promise<ApiResult<T>>` を返す。
- SDK の生エラーを UI へ渡さず、`ApiErrorCode` へ正規化する。
- リクエスト・レスポンス型は `API計画書.md` と一致させる。
- API が返す価格、効果、残高、人口、順位を表示する。
- 読み取りデータと更新データの所有者を Hook 単位で明確にする。
- 実 API とモックは同じ interface を実装する。

共通結果型は次を基準とする。

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

### 8.2 Service の分割

| Service | 主な関数 | 通信先 |
|---|---|---|
| `auth` | `getGoogleIntegrationState`, `signInWithGoogle`, `signOut`, `startGoogleHealthConnection`, `disconnectGoogleHealth` | Supabase Auth / Edge Function |
| `health` | `getDashboard`, `syncSteps` | View / Query、`sync-health-steps` Edge Function |
| `town` | `getBuildingCatalog`, `getMyTown`, `getPublicTown`, `placeBuilding`, `moveBuilding` | Query / View / RPC |
| `ranking` | `getPopulationRanking` | View / RPC |

サービス関数名はバックエンドの物理名ではなく、フロントエンドのユースケース名にする。RPC 名や Edge Function 名の変更影響は Service 内に閉じ込める。

### 8.3 Hook の公開形

データ取得ライブラリが TBD のため、機能コンポーネントへ公開する形を揃える。

```ts
type QueryState<T> = {
  data: T | null
  isLoading: boolean
  isRefreshing: boolean
  error: ApiError | null
  refetch: () => Promise<void>
}
```

更新 Hook は `mutate`、`isSubmitting`、`error` を公開し、成功後の関連データ更新まで責任を持つ。ライブラリ採用後は、その戻り値を直接全コンポーネントへ広げず、feature Hook で必要な形へ包む。

### 8.4 データの更新・再取得

| 操作 | 成功時 | 失敗・競合時 |
|---|---|---|
| `syncSteps()` | `StepSyncStatus` の歩数・残高・同期日時を反映し、必要なら Dashboard を再取得 | 推測更新しない。再試行を表示 |
| `placeBuilding()` | 返却された建物・残高・人口を反映し、必要なら自分の街を再取得 | プレビューを維持。`CONFLICT` 等では街を再取得 |
| `moveBuilding()` | 返却された建物座標・人口を反映し、必要なら自分の街を再取得 | 元データを維持。結果不明なら同じ `requestId` で再送または再取得 |
| Health 連携・解除 | 接続状態を再取得 | 接続済みと推測しない |
| Ranking 追加取得 | 既存 entries の後ろへ追加 | 既存 entries を維持し、追加取得だけ再試行 |

成功レスポンスによる部分更新と再取得のどちらを採用してもよいが、同じ画面内でコインや人口の異なる値を同時表示しない。`catalogVersion` が変化した場合はカタログを再取得する。

### 8.5 エラー処理

主な分岐は以下のとおりとする。

| エラー | UI 方針 |
|---|---|
| `UNAUTHENTICATED` | 更新を停止し、再ログインへ誘導 |
| `HEALTH_NOT_CONNECTED` | Health 連携ボタンを表示 |
| `HEALTH_PERMISSION_REQUIRED` | 再同意を案内 |
| `HEALTH_PROVIDER_ERROR` | 値を推測更新せず再試行 |
| `CATALOG_ITEM_DISABLED`, `PRICE_NOT_SET` | 選択解除または購入不可表示、カタログ再取得 |
| `INSUFFICIENT_COINS` | 最新残高を反映してコイン不足を表示 |
| `OUT_OF_MAP`, `LAND_LOCKED`, `ROAD_REQUIRED` | プレビューを維持して理由を表示 |
| `CELL_OCCUPIED`, `CONFLICT` | 街を再取得し、再操作を案内 |
| `NOT_OWNER` | 編集 UI を停止 |
| `NOT_FOUND` | 対象が存在しない画面を表示 |
| `INTERNAL_ERROR` | 一般メッセージと安全な再試行 |

### 8.6 キャッシュとキー

サーバー状態管理ライブラリを採用する場合、概念上のキーは次の単位とする。

```text
['auth', 'integration-state']
['dashboard', currentUserId]
['town', 'self', currentUserId]
['town', 'public', userId]
['building-catalog', catalogVersion?]
['population-ranking', cursor?]
```

ユーザー ID を含まない「現在の街」だけのグローバルキーを避け、ログアウト・ユーザー切り替え時に本人データが残らないよう認証依存キャッシュを破棄する。公開街へ遷移した直後に前の街のデータを表示しない。

### 8.7 環境変数

ブラウザで使用可能な値だけを Vite の公開環境変数として扱う。

- Supabase Project URL
- Supabase Anonymous / Publishable Key
- 実 Service / Mock Service の切り替え値

環境変数は `lib/supabase.ts` または Provider 生成箇所で検証し、未設定時は起動時に開発者向けの明確なエラーとする。秘密鍵、Service Role Key、Google クライアントシークレットはフロントエンド環境変数へ置かない。

## 9. 認証設計

### 9.1 認証状態モデル

初回セッション復元と未認証を区別する。

```ts
type AuthState =
  | { status: 'initializing' }
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: ApiError }
```

アプリ起動時に一度 `getSession()` または `getGoogleIntegrationState()` を実行し、その後は Supabase Auth の状態変更イベントを購読する。購読は Provider の破棄時に解除する。Page や個別ボタンが別々にセッションを保持しない。

### 9.2 Google ログイン

1. `LoginButton` が `useAuth()` のログイン処理を呼ぶ。
2. `auth` Service が `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })` を呼ぶ。
3. Google / Supabase の OAuth が完了し、アプリへ戻る。
4. Auth Provider がセッションを復元する。
5. バックエンドが初回ユーザーの `profiles` と `towns` を冪等に作成する。
6. フロントエンドは `/` へ置換遷移し、Dashboard と自分の街を取得する。

ログイン時に要求するのは本人識別に必要なスコープに限定し、Health の歩数読み取りスコープを混ぜない。ログイン開始中はボタンを無効化する。

### 9.3 Google Health 連携

ログイン後、接続状態に応じて UI を切り替える。

| status | 表示・操作 |
|---|---|
| `connected` | 最終同期日時、同期ボタン、連携解除 |
| `not_connected` | 歩数未連携の説明、連携開始ボタン |
| `permission_required` | 権限不足の説明、再同意ボタン |

`startGoogleHealthConnection()` が `{ next: 'redirect' }` を返した場合のみ `authorizationUrl` へ遷移する。モックの `{ next: 'connected' }` では外部遷移せず状態を更新する。認可 URL はバックエンドが生成し、フロントエンドで OAuth パラメータや `state` を組み立てない。

### 9.4 ログアウトと連携解除

- `signOut()` は Supabase セッションのみ終了する。
- ログアウト成功後は認証依存のメモリ・キャッシュを破棄し、`/login` へ置換遷移する。
- Google Health 連携状態はログアウトだけでは削除しない。
- `disconnectGoogleHealth()` は Health 接続だけを解除し、ログイン状態は維持する。
- 連携解除は影響を説明した確認 UI を挟む。

### 9.5 セキュリティ

- 認証・更新対象の本人性は Supabase JWT の `sub` を正とする。
- 更新 API へ本人の `userId` を送らない。
- Route Guard と `editable` は UX のための防御であり、認可は RLS / RPC で行う。
- セッション、認可コード、トークン、URL fragment をログへ出さない。
- `localStorage` へ Google Health のトークンや独自の認証コピーを保存しない。
- 外部 URL へ遷移するときは、Service が返した Health 認可 URL であることを前提とし、任意入力の URL を使用しない。
- 認証エラーの詳細をクエリパラメータのまま表示せず、安全なエラーコードへ変換する。

### 9.6 認証失効時

API が `UNAUTHENTICATED` を返した場合は次の順で処理する。

1. 進行中の配置・移動・同期操作を停止する。
2. ローカルで成功したように表示しない。
3. Auth Provider のセッションを再確認する。
4. セッションがない場合は認証依存キャッシュを破棄する。
5. 再ログインが必要であることを案内し、`/login` へ誘導する。

## 10. 命名規則

### 10.1 ファイル・ディレクトリ

| 対象 | 規則 | 例 |
|---|---|---|
| React Component / Page | `PascalCase.tsx` | `TownMap.tsx`, `RankingPage.tsx` |
| Hook | `use` + `PascalCase.ts` | `useAuth.ts`, `useMyTown.ts` |
| Service | 小文字 `camelCase.ts` または機能名 | `auth.ts`, `town.ts`, `apiError.ts` |
| 型の集約ファイル | `types.ts`、共有型は意味名 | `types.ts`, `user.ts`, `common.ts` |
| ディレクトリ | 小文字、単数の feature 名 | `features/town/`, `features/auth/` |
| テスト | 対象名 + `.test.ts(x)` | `TownMap.test.tsx`, `town.test.ts` |
| Story / fixture を導入する場合 | 対象名 + 用途 suffix | `TownMap.stories.tsx` |

既存の `api-error.ts` のような技術ユーティリティは kebab-case を許容する。新規ファイルでは同じディレクトリ内の規則を統一し、同じ用途で `api/` と `services/` を併存させない。

### 10.2 TypeScript 識別子

| 対象 | 規則 | 例 |
|---|---|---|
| Component / 型 / Union | PascalCase | `BuildingCard`, `TownDetail`, `MapMode` |
| 関数 / 変数 | camelCase | `getMyTown`, `coinBalance` |
| Hook | `use` prefix | `usePopulationRanking` |
| 定数 | UPPER_SNAKE_CASE | `MIN_ZOOM`, `MAX_ZOOM` |
| boolean | `is`, `has`, `can`, `should` | `isEditable`, `hasNextPage`, `canSubmit` |
| Props callback | `on` prefix | `onRetry`, `onSelectCell` |
| Event handler | `handle` prefix | `handleRetry`, `handleSelectCell` |
| Context / Provider | 用途 + `Context` / `Provider` | `AuthContext`, `AuthProvider` |
| Service interface | 用途 + `Service` または既存契約名 | `TownService`, `GoogleIntegrationApi` |

型名に `I` prefix、type に `T` prefixは付けない。省略語だけの名前を避け、`data`、`item`、`result` は短いローカルスコープ以外では具体化する。

### 10.3 ドメイン名

- ユーザー識別子: `userId`
- 街識別子: `townId`
- 配置済み建物識別子: `buildingId`
- 建物種別: `buildingTypeCode`
- 左上アンカー: `anchorX`, `anchorY`
- サイズ: `width`, `height`
- 所持コイン: `coinBalance`、街要約の API フィールドは契約どおり `coins`
- 人口: `population`
- 歩数: `steps`
- ISO 8601 日時: `...At`（例: `syncedAt`, `updatedAt`）
- `YYYY-MM-DD` の日付: `date`
- IANA タイムゾーン: `timezone`
- 冪等キー: `requestId`

API 契約のフィールド名を UI 内で別名へ無秩序に変換しない。表示用の整形値は `formattedPopulation`、`lastSyncedAtLabel` のように元データと区別する。

### 10.4 API 関数

- 読み取り: `get` + 対象名 (`getDashboard`, `getPublicTown`)
- 更新: 動詞 + 対象名 (`placeBuilding`, `moveBuilding`, `syncSteps`)
- 認証開始: `signInWithGoogle`
- セッション終了: `signOut`
- 外部連携開始・解除: `startGoogleHealthConnection`, `disconnectGoogleHealth`

Service 関数は `ApiResult<T>` を返し、`fetchTown` と `getTown` のような同義の命名を同一機能内で混在させない。

### 10.5 CSS・表示文言

Tailwind CSS のユーティリティを基本とする。追加の CSS class を定義する場合は kebab-case とし、機能名を prefix に含めて衝突を避ける。色名だけの class や、DOM 構造に過度に依存する名前を避ける。

ユーザー向け文言は日本語で統一し、API エラーコードをそのまま表示しない。同じエラーに対する文言は feature 内で集約し、コンポーネントごとに異なる解釈を持たせない。
