# Phase 8 自動テスト実施結果

## 対象

`本番Supabase接続実装計画書` の Phase 8 のうち、自動テストを対象とする。実 Supabase 環境を使うステージング統合テストとリリース作業は対象外とする。

## 確認項目

| 項目 | 主な確認箇所 | 結果 |
| --- | --- | --- |
| Supabase Town / Ranking Service | `town.test.ts`、`ranking.test.ts` | 実施済み |
| runtime validator と fixture | `town-contract.test.ts`、`ranking-contract.test.ts` | 実施済み |
| View・RPC・Edge Function の物理名と引数 | Town・Ranking・Google Integration・Step Sync の Service テスト | 実施済み |
| JWT・サーバー決定値を更新要求へ含めない | 配置・移動・道路・土地開放・歩数同期の呼出引数テスト | 実施済み |
| Provider の mock / Supabase 切替 | `create-api-services.test.ts` | 実施済み |
| 読込・空・再試行・認証切れ・404・競合・不正レスポンス | 各 Hook・Component・Service テスト | 実施済み |
| 二重送信防止と requestId 再送 | `TownMap.test.tsx` | 実施済み |
| 公開街の編集不可と非公開項目の拒否 | `town.test.ts`、公開街・公開プロフィール関連テスト | 実施済み |
| 人口変更後のランキング再取得 | `mocks/services/ranking.test.ts` | 実施済み |
| test・lint・build | Phase 8 完了時に実行 | 実施済み |

## 留意事項

- `getDashboard()` は実装・使用していない。
- 建物名変更はバックエンド未採用のため、Supabase モードでは UI を表示しない。
- ステージング統合テストは実環境の URL、公開キー、OAuth Redirect URL、デプロイ済み View・RPC・Edge Function が揃った後に別途実施する。
