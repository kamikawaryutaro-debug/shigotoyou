import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { initializeDatabase } from './db.js';
import contractRoutes from './routes/contracts.js';
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employee.js';
import pushRoutes from './routes/push.js';
import lineRoutes from './routes/line.js';
import adminRoutes from './routes/admin.js';

// タイムゾーン設定（日本時間）
process.env.TZ = 'Asia/Tokyo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('--- STARTUP ENV CHECK ---');
console.log('LINE_LOGIN_CHANNEL_ID:', process.env.LINE_LOGIN_CHANNEL_ID || 'MISSING');
console.log('DATABASE_PATH:', process.env.DATABASE_PATH || 'DEFAULT');
console.log('-------------------------');

const app = express();
const PORT = process.env.PORT || 5000;

// ミドルウェア
// CORS: file:// プロトコル（ローカルHTML）も許可するため origin: true
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 静的ファイル (アップロードされたファイル)
const uploadsPath = process.env.UPLOADS_PATH 
  ? path.resolve(process.cwd(), process.env.UPLOADS_PATH)
  : path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API ルート
app.use('/api/contracts', contractRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/line', lineRoutes);
app.use('/api/admin', adminRoutes);

// 基本API情報
app.get('/api', (req, res) => {
  res.json({
    name: 'Contract Approval System API',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      contracts: '/api/contracts',
      auth: '/api/auth',
      employee: '/api/employee',
      push: '/api/push'
    }
  });
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// サーバー起動
const startServer = async () => {
  try {
    // データベース初期化
    console.log('🔧 データベースを初期化中...');
    const db = await initializeDatabase();
    console.log('✅ データベース接続成功');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 契約書電子承認システム API サーバー起動`);
      console.log(`📍 ポート: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`📋 API: http://localhost:${PORT}/api`);
      console.log(`🔑 認証: http://localhost:${PORT}/api/auth`);
      console.log(`👤 従業員: http://localhost:${PORT}/api/employee`);
      console.log(`🔔 プッシュ: http://localhost:${PORT}/api/push`);
      console.log(`💚 ヘルスチェック: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('❌ サーバー起動失敗:', error);
    process.exit(1);
  }
};

startServer();
