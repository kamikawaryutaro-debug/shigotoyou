import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数またはデフォルトのパス（プロセス実行ディレクトリ基準）
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.join(__dirname, '..', '..', 'data', 'contract_approval.db');

let db = null;

// データベース初期化
export const initializeDatabase = async () => {
  try {
    // data フォルダが存在しない場合は作成
    const dataDir = path.dirname(dbPath);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (err) {
      // フォルダ作成失敗（既存の場合）
    }

    // SQLite接続
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // --- 自動移行: email カラムの NOT NULL 制約を解除 ---
    try {
      const tableInfo = await db.all("PRAGMA table_info(users)");
      const emailCol = tableInfo.find(c => c.name === 'email');

      // notnull === 1 の場合は制約があるため移行が必要
      if (emailCol && emailCol.notnull === 1) {
        console.log('🔧 email カラムの制約変更（移行）を開始します...');
        await db.exec('BEGIN TRANSACTION;');

        // 1. 新しいテーブル作成
        await db.exec(`
          CREATE TABLE IF NOT EXISTS users_new (
            id TEXT PRIMARY KEY,
            employee_id TEXT UNIQUE NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT,
            phone TEXT,
            department TEXT,
            position TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_login_at TEXT,
            line_user_id TEXT
          );
        `);

        // 2. データ移行
        await db.exec('INSERT INTO users_new SELECT * FROM users;');
        // 3. 元のテーブル削除
        await db.exec('DROP TABLE users;');
        // 4. 名前変更
        await db.exec('ALTER TABLE users_new RENAME TO users;');
        // 5. インデックス再作成
        await db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
        await db.exec('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);');

        await db.exec('COMMIT;');
        console.log('✅ 移行完了: users テーブルの email カラムを任意項目に変更しました');

        // 移行と同時にパスワードも一度リセットして初期状態に戻す
        await db.run('UPDATE users SET password_hash = NULL');
        console.log('🔑 本番環境のパスワードをリセットしました（初回ログイン待ち状態）');
      }
    } catch (e) {
      try { await db.exec('ROLLBACK;'); } catch (r) { }
      console.error('⚠️ 移行失敗:', e.message);
    }

    // --- 本番環境用: パスワードリセット（初回のみ/または必要に応じて） ---
    // もし環境変数 RESET_PASSWORDS があれば、全ユーザーのパスワードをリセットする
    if (process.env.RESET_PASSWORDS === 'true') {
      try {
        await db.run('UPDATE users SET password_hash = NULL');
        console.log('🔑 パスワードリセット完了: 全従業員が新しいパスワードでログイン可能です');
      } catch (e) {
        console.error('⚠️ パスワードリセット失敗:', e.message);
      }
    }

    // テーブル作成
    await createTables();

    // 既存のテーブルへのカラム追加（自動移行 - テーブル作成後に実行）
    const migrateColumns = async (tableName, columns) => {
      try {
        const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
        const existingColumns = tableInfo.map(c => c.name);
        
        for (const col of columns) {
          if (!existingColumns.includes(col.name)) {
            try {
              // 注意: SQLiteのALTER TABLE ... ADD COLUMNでは、DEFAULT制約にいくつかの制限があります
              await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`);
              console.log(`✅ ${tableName} テーブルに ${col.name} カラムを追加しました`);
            } catch (e) {
              console.warn(`⚠️ ${tableName} への ${col.name} 追加失敗:`, e.message);
            }
          }
        }
      } catch (err) {
        console.warn(`⚠️ ${tableName} の情報取得に失敗しました:`, err.message);
      }
    };

    try {
      await migrateColumns('users', [
        { name: 'phone', type: 'TEXT' },
        { name: 'department', type: 'TEXT' },
        { name: 'position', type: 'TEXT' },
        { name: 'status', type: 'TEXT DEFAULT "active"' },
        { name: 'created_at', type: 'TEXT DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'TEXT DEFAULT CURRENT_TIMESTAMP' },
        { name: 'last_login_at', type: 'TEXT' },
        { name: 'line_user_id', type: 'TEXT' }
      ]);
    } catch (e) {
      console.warn('⚠️ users テーブルの移行中にエラーが発生しました:', e.message);
    }

    console.log(`✅ SQLite データベース接続: ${dbPath}`);
    return db;
  } catch (error) {
    console.error('❌ データベース初期化失敗:', error);
    throw error;
  }
};

// テーブル作成
const createTables = async () => {
  const sql = `
    -- ユーザー（従業員）テーブル
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      employee_id TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT,
      phone TEXT,
      department TEXT,
      position TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT,
      line_user_id TEXT
    );

    -- 契約書テーブル
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      contract_id TEXT UNIQUE NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT,
      file_size INTEGER,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      total_sheets INTEGER DEFAULT 0,
      completed_sheets INTEGER DEFAULT 0,
      status TEXT DEFAULT 'in_progress',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    -- 契約書シート（従業員対応）テーブル
    CREATE TABLE IF NOT EXISTS contract_sheets (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      sheet_index INTEGER,
      sheet_data TEXT,
      pdf_url TEXT,
      status TEXT DEFAULT 'pending',
      sent_at TEXT,
      viewed_at TEXT,
      signed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(contract_id, user_id),
      FOREIGN KEY (contract_id) REFERENCES contracts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 署名テーブル
    CREATE TABLE IF NOT EXISTS signatures (
      id TEXT PRIMARY KEY,
      contract_sheet_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      signature_data TEXT NOT NULL,
      signature_image_url TEXT,
      signed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      device_os TEXT,
      device_model TEXT,
      browser_user_agent TEXT,
      location TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_sheet_id) REFERENCES contract_sheets(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 監査ログテーブル
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      description TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- セッションテーブル
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      refresh_token TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- プッシュ通知購読テーブル
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      keys TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- インデックス作成
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
    CREATE INDEX IF NOT EXISTS idx_contracts_uploaded_at ON contracts(uploaded_at);
    CREATE INDEX IF NOT EXISTS idx_contract_sheets_status ON contract_sheets(status);
    CREATE INDEX IF NOT EXISTS idx_signatures_user_id ON signatures(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
  `;

  try {
    await db.exec(sql);
    console.log('✅ テーブル作成・確認完了');

    // サンプルデータ挿入
    await insertSampleData();
  } catch (error) {
    console.error('❌ テーブル作成失敗:', error);
    throw error;
  }
};

// サンプルデータ挿入
const insertSampleData = async () => {
  try {
    // 既存データ確認
    const existingUsers = await db.get('SELECT COUNT(*) as count FROM users');

    if (existingUsers && existingUsers.count > 0) {
      console.log(`✅ サンプルデータは既に存在します（${existingUsers.count}名）`);

      // ただし、「清水」がいない場合は追加する
      const shimizu = await db.get('SELECT id FROM users WHERE last_name = ?', ['清水']);
      if (!shimizu) {
        console.warn('⚠️ 清水がいないため追加します');
        const { v4: uuidv4 } = await import('uuid');
        await db.run(
          `INSERT INTO users (id, employee_id, first_name, last_name, full_name, email, department, position, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [uuidv4(), 'EMP006', '恭子', '清水', '清水 恭子', 'shimizu.kyoko@example.com', '営業部', 'パートタイマー']
        );
        console.log('✅ 清水 恭子を追加しました');
      }
      return;
    }

    // サンプル従業員データ
    const { v4: uuidv4 } = await import('uuid');
    const sampleUsers = [
      { id: uuidv4(), employee_id: 'EMP001', first_name: '太郎', last_name: '田中', full_name: '田中 太郎', email: 'tanaka.taro@example.com', department: '営業部', position: 'パートタイマー' },
      { id: uuidv4(), employee_id: 'EMP002', first_name: '花子', last_name: '鈴木', full_name: '鈴木 花子', email: 'suzuki.hanako@example.com', department: '事務部', position: 'アルバイト' },
      { id: uuidv4(), employee_id: 'EMP003', first_name: '次郎', last_name: '佐藤', full_name: '佐藤 次郎', email: 'sato.jiro@example.com', department: '営業部', position: 'パートタイマー' },
      { id: uuidv4(), employee_id: 'EMP004', first_name: '美咲', last_name: '高橋', full_name: '高橋 美咲', email: 'takahashi.misaki@example.com', department: '企画部', position: 'アルバイト' },
      { id: uuidv4(), employee_id: 'EMP005', first_name: '一郎', last_name: '山田', full_name: '山田 一郎', email: 'yamada.ichiro@example.com', department: '営業部', position: 'パートタイマー' },
      { id: uuidv4(), employee_id: 'EMP006', first_name: '恭子', last_name: '清水', full_name: '清水 恭子', email: 'shimizu.kyoko@example.com', department: '営業部', position: 'パートタイマー' }
    ];

    for (const user of sampleUsers) {
      await db.run(
        `INSERT INTO users (id, employee_id, first_name, last_name, full_name, email, department, position, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [user.id, user.employee_id, user.first_name, user.last_name, user.full_name, user.email, user.department, user.position]
      );
    }

    console.log('✅ サンプルデータ（従業員6名）を挿入しました');
  } catch (error) {
    // エラーは出力するが処理は継続
    console.warn('⚠️ サンプルデータ挿入スキップ:', error.message);
  }
};

// データベース取得
export const getDatabase = () => {
  if (!db) {
    throw new Error('データベースが初期化されていません');
  }
  return db;
};

// ユーティリティ関数
export const dbQuery = async (sql, params = []) => {
  return await db.all(sql, params);
};

export const dbRun = async (sql, params = []) => {
  return await db.run(sql, params);
};

export const dbGet = async (sql, params = []) => {
  return await db.get(sql, params);
};
