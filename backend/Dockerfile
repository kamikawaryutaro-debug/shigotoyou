FROM node:18-bullseye-slim

# SQLite3のビルドに必要なツールをインストール（念のため）
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# パッケージ定義ファイルをコピーして依存関係をインストール
COPY package*.json ./
RUN npm install --production

# アプリケーションのソースコードをコピー
COPY . .

# データを保存するディレクトリを作成し、所有者をnodeユーザーに変更
RUN mkdir -p /app/data /app/uploads && chown -R node:node /app

# セキュリティのため非rootユーザーで実行
USER node

# 環境変数（Fly.ioの永続ボリュームのマウント先を設定）
ENV DATABASE_PATH=/app/data/contract_approval.db

# ポートの公開
EXPOSE 5000

# サーバー起動
CMD ["npm", "start"]
