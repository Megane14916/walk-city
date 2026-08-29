# 本プロジェクトの内容について

このプロジェクトでは、Google Health APIを利用して歩数を取得し、それをゲーム内のコインに変換する機能を提供します。
ユーザーはGoogleアカウントでログインし、自分の街を作り、建物を配置して人口を増やすことができます。
建物にはそれぞれ効果があり、歩数によるコインの増加や人口の増加など、ゲームプレイに影響を与えます。

# 出力と入力のルール

- 出力は必ず日本語を利用してください。
- 入力は日本語でも英語でも構いません。

# コードスタイル

- バックエンドのフレームワークはSupabase、フロントエンドではReactを使用します。
- コードは可読性を重視し、適切なコメントを各部に記述してください。
- コメントは日本語で記述してください。ただし、ファイル名は英語で記述してください。
- 変数や定数等の名前は、各言語のデファクトスタンダードに従ってください (例: camelCase, PascalCase, snake_caseなど)。

# 利用するAPI / サービスについて

- **Google Health API**: ユーザーの歩数データを取得するために使用します。ユーザーの同意が必要です。
- **Supabase Database**: データベースおよびEdge Functionsを提供します。ユーザーのプロフィールや街のデータを管理します。
- **Supabase Auth**: Googleログインを提供し、ユーザーの認証とセッション管理を行います。

# 要件

- 要件についてはdocsのマークダウンを参照してください。
- なお、名称や内容が変更となる場合があるため、適宜確認してください。
- また必要に応じて、SupabaseのドキュメントやGoogle Health APIのドキュメントも参照してください。

# ディレクトリ構造
- 本プロジェクトでは、以下のディレクトリ構造を採用しています。

```
-.github/
  copilot-instructions.md # 本ファイル
- .vscode/
  - settings.json # VSCodeの設定ファイル
- docs/ # 一部ファイルのみ抜粋
  - API計画書.md
  - architecture.md
  - バックエンド.md
- frontend/
  - src/
    - components/ # Reactコンポーネントを格納するディレクトリ
    - pages/ # ページコンポーネントを格納するディレクトリ
    - App.tsx # Reactアプリケーションのエントリーポイント
    - index.tsx # Reactアプリケーションのルートファイル
- supabase/
  - functions/
    - google_health_fetch/
      - index.ts # Google Health APIから歩数データを取得するためのSupabase Edge Function
    - test_function/
      - index.ts # テスト用のSupabase Edge Function
```