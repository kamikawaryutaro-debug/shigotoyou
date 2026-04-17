# 画像化エクセル表示 - セットアップガイド

## 必要なシステムツール

この機能は以下のツールが**サーバーにインストール**されていることが必要です：

### 1. LibreOffice（必須）

ExcelファイルをPDFに変換するために使用します。

#### Windows
```powershell
# 公式サイトからダウンロード
# https://www.libreoffice.org/download/
# インストーラーを実行してセットアップ

# または、Choco を使用して自動インストール
choco install libreoffice-still -y
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install libreoffice -y
```

#### macOS
```bash
brew install libreoffice
```

**確認コマンド：**
```bash
# Windows
soffice --help

# Linux/Mac
libreoffice --help
```

---

### 2. Ghostscript（必須）

PDFバッファをPNG画像にレンダリングするために使用します。

#### Windows
```powershell
# 公式サイトからダウンロード
# https://www.ghostscript.com/download/gsdnld.html
# インストーラーを実行してセットアップ

# または、Choco を使用して自動インストール
choco install ghostscript -y
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install ghostscript -y
```

#### macOS
```bash
brew install ghostscript
```

**確認コマンド：**
```bash
gswin64c --help       # Windows
gs --help             # Linux/Mac
```

---

## Node.js パッケージ

以下のパッケージがインストール済みです：

- **sharp**: 画像処理ライブラリ
- **pdf-page-counter**: PDF情報抽出

```bash
cd backend
npm install sharp pdf-page-counter
```

---

## エンドポイント

### 画像化API
```
GET /api/employee/contracts/:sheetId/images?token=TOKEN
```

**レスポンス例:**
```json
{
  "success": true,
  "data": [
    {
      "page": 1,
      "base64": "iVBORw0KGgoAAAANSUhEUgAAAA...",
      "mimeType": "image/png"
    },
    {
      "page": 2,
      "base64": "iVBORw0KGgoAAAANSUhEUgAAAA...",
      "mimeType": "image/png"
    }
  ],
  "pageCount": 2
}
```

---

## トラブルシューティング

### エラー: "LibreOfficeがインストールされていません"
- → LibreOffice をインストールしてください
- → Windows では `soffice` コマンドが PATH に登録されているか確認

### エラー: "Ghostscriptがインストールされていません"
- → Ghostscript をインストールしてください
- → Windows では `gswin64c` コマンドが PATH に登録されているか確認

### 画像が出力されない
- サーバーログを確認: `console.log()` メッセージを確認

### メモリ不足エラー
- 複雑で大規模なExcelファイルの場合は、エンドポイントのタイムアウト値を増やしてください

---

## セットアップチェックリスト

- [ ] LibreOffice がインストール済み
- [ ] Ghostscript がインストール済み
- [ ] `npm install` が実行済み
- [ ] バックエンド再起動済み
- [ ] 従業員アプリで契約書を開いてテスト済み

---

## 参考リンク

- LibreOffice: https://www.libreoffice.org/
- Ghostscript: https://www.ghostscript.com/
