# 契約書電子承認システム - CHANGELOG

すべての重要な変更は、このファイルに記録されます。

## [未リリース]

### 計画中の機能
- OneSignal プッシュ通知統合
- メール通知機能
- PDF直接署名（署名画像をPDFへ埋め込み）
- 契約書テンプレート機能
- 生体認証（Face ID / Touch ID）
- オフラインモード
- 多言語対応（英語・中国語）
- ワークフロー承認機能（複数段階承認）

### セキュリティアップデート
- 日程別に更新予定

---

## [1.1.0] - 2026-04-29

### Fixed - 契約書表示の改善（スケール縮小方式）

#### 概要
従業員PWAの契約書プレビューを、外部ソフト（LibreOffice等）に依存せず、
**ブラウザ内でExcelのレイアウトを忠実に再現**するよう改修。

#### 技術詳細（元に戻す際の参考）

**方式: スケール縮小表示（Scale-to-Fit）**
1. バックエンド `excelService.getSheetHtml()` でExcelの列幅・行高さ・結合セル・罫線・画像を忠実にHTMLテーブルとして出力
2. フロントエンド `contract-view.js` でテーブルの自然な幅を測定し、`transform: scale()` で画面幅に自動縮小

**変更ファイル:**
- `backend/src/services/excelService.js`
  - `getSheetHtml()`: テーブル幅を列幅合計から計算し `min-width` と `width` に設定
  - `_getCellStyles()`: `white-space: nowrap`（デフォルト）、`overflow: hidden` を削除
  - `_formatValue()`: Excelの日付シリアル値を正しい日付に変換する機能を追加
- `employee-pwa/src/pages/contract-view.js`
  - `initContractView()`: テーブル描画後にscale係数を計算しCSSで縮小表示
- `employee-pwa/src/styles/index.css`
  - `.excel-preview-container`: `overflow-x: auto` 追加
  - `#contract-table td`: `line-height: 1.4` 追加

**重要な設定値:**
```
フォントサイズ: 10pt（excelService.js内）
列幅計算式: col.width * 7.5 + 5（px）
行高計算式: row.height * 1.33（px）
デフォルト列幅: 64px
デフォルト行高: 20px
```

---

## [1.0.0] - 2026-03-14

### Added - 初期リリース

#### バックエンド
- ✅ JWT認証（アクセストークン + リフレッシュトークン）
- ✅ ユーザーセッション管理
- ✅ PostgreSQL統合
- ✅ Excel契約書からの名前自動抽出
- ✅ 契約書アップロード・管理API
- ✅ 署名データ保存（Base64画像）
- ✅ 監査ログシステム
  - 本人認証情報記録
  - タイムスタンプ（ミリ秒精度）
  - IPアドレス記録
  - デバイス情報（OS、ブラウザ）
  - User-Agent記録
- ✅ PDF生成・保存機能

#### モバイルアプリ (React Native)
- ✅ iOS / Android 対応
- ✅ ログイン画面
- ✅ 契約書内容確認画面
  - スクロール強制確認
  - 自動スクロール検出
- ✅ タップ式署名パッド
- ✅ 署名完了画面
- ✅ PDF保存機能
- ✅ 安全なトークン保存（SecureStore）
- ✅ デバイス情報自動取得

#### 管理画面 (React)
- ✅ ユーザーログイン
- ✅ 契約書ドラッグ&ドロップアップロード
- ✅ 従業員自動抽出表示
- ✅ 契約書一覧表示
- ✅ 署名状況ダッシュボード
- ✅ 統計情報表示

#### データベース
- ✅ スキーマ定義（7テーブル）
  - users
  - contracts
  - contract_distributions
  - signatures
  - contract_downloads
  - audit_logs
  - sessions
- ✅ インデックス最適化
- ✅ リレーション設計

#### ドキュメント
- ✅ API仕様書 (APIドキュメント)
- ✅ データベース設計 (スキーマ、クエリ例)
- ✅ デプロイメント手順 (Linux/Nginx設定)
- ✅ 開発ガイド (コーディング規約、Git規約)
- ✅ README (プロジェクト概要)

### Infrastructure
- ✅ Node.js Express バックエンド
- ✅ PostgreSQL データベース
- ✅ React Native モバイルフレームワーク
- ✅ React 管理画面
- ✅ bcryptjs パスワード暗号化
- ✅ jsonwebtoken JWT管理
- ✅ exceljs Excel解析
- ✅ pdfkit PDF生成

### 推奨デプロイ構成
```
┌─────────────────┐
│  モバイルアプリ   │
│  (iOS/Android)  │
└────────┬────────┘
         │ HTTPS
┌────────▼────────────┐
│   REST API Backend   │
│  (Node.js + Express) │
└────────┬────────────┘
         │ TCP
┌────────▼──────────────┐
│   PostgreSQL数据库    │
│  (監査ログ完全記録)    │
└───────────────────────┘
```

### セキュリティ機能
- ✓ JWT トークンベース認証（有効期限7日）
- ✓ bcrypt10ラウンドパスワードハッシュ化
- ✓ HTTPS/SSL対応
- ✓ CORS設定機能
- ✓ 監査ログ全記録
- ✓ インプット検証
- ✓ SQL インジェクション対策

### テスト環境
```bash
バックエンド: npm test
モバイル: React Native Debugger
API: Postman / Thunder Client
DB: pgAdmin UI
```

---

## Release Notes

### 本番環境チェックリスト
- [ ] 全テスト成功
- [ ] セキュリティレビュー完了
- [ ] パフォーマンステスト完了
- [ ] バックアップ設定完了
- [ ] SSL証明書設定完了
- [ ] ロギング設定完了
- [ ] アラート設定完了
- [ ] ドキュメント完成

### サポートとアップデート
- バグ報告: GitHub Issues
- 機能リクエスト: GitHub Discussions
- セキュリティ問題: security@example.com

---

**作成日**: 2026-03-14  
**リーダー**: development team  
**ステータス**: 開発完了、本番待機
