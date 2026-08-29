# Walk City Frontend

Walk CityのReact 19、TypeScript、Viteフロントエンドです。APIは`ApiProvider`でモック実装とSupabase実装を切り替えます。

## セットアップ

```sh
npm install
Copy-Item .env.example .env.local
npm run dev
```

`.env.local`はGit管理しません。

## APIモード

### ローカルのモック開発

```dotenv
VITE_API_MODE=mock
```

開発環境では`VITE_API_MODE`未指定時もモックを使用します。画面やフロントエンドのテストをSupabaseなしで実行できます。

### ローカル・ステージングのSupabase接続

```dotenv
VITE_API_MODE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

レガシー環境との互換性のため`VITE_SUPABASE_ANON_KEY`も読み取れますが、新規設定では`VITE_SUPABASE_PUBLISHABLE_KEY`を使用します。

### 本番

Viteの本番環境では次の3変数が必須です。

```dotenv
VITE_API_MODE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

本番で`VITE_API_MODE`が未指定または`mock`の場合、アプリは起動時に明示的に失敗します。設定漏れによってモックデータを本番表示しないための仕様です。

## 秘密情報

`VITE_*`はビルドされたJavaScriptから閲覧できます。次の値を置かないでください。

- Supabase Service Role Key
- Google OAuth Client Secret
- Google Healthの認可コード
- Google access token / refresh token
- DB接続文字列

ブラウザではSupabaseのpublishable keyだけを使用します。Google Healthの秘密情報はSupabase Edge FunctionのSecretsで管理します。

## Supabase通信境界

- Supabase Clientは`src/lib/supabase.ts`で生成します。
- Supabase固有のQuery、RPC、Edge Function呼び出しはFeature Serviceへ閉じ込めます。
- ComponentとHookは`ApiResult<T>`を返すFeature APIだけを使用します。
- DBの`snake_case`から画面型の`camelCase`への変換はService内で行います。
- サーバー応答はruntime validatorで検証してからUIへ渡します。
- SQL、token、stack、外部APIの生レスポンスは画面へ表示しません。

Phase 0の物理API契約は[本番Supabase接続Phase0契約決定書](../docs/本番Supabase接続Phase0契約決定書.md)を参照してください。

## Database型

Supabase migrationまたは接続可能な確定スキーマが共有された後、Supabase CLIで型を生成してコミットします。Phase 1時点ではリポジトリに実スキーマがないため、推測した`Database`型は作成せず、Town／Rankingのruntime validatorを先行実装しています。

生成時のコマンド例：

```sh
supabase gen types typescript --project-id PROJECT_ID --schema public > src/types/database.generated.ts
```

生成ファイルは手編集せず、migration変更時に再生成します。

## コマンド

```sh
npm run dev
npm test
npm run lint
npm run build
npm run preview
```

本番接続の変更では、最低限`npm test`、`npm run lint`、`npm run build`を実行します。
