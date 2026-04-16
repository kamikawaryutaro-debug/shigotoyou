import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data', 'contract_approval.db');

async function checkContracts() {
  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log('\n📋 [アップロード済み契約書の状態]');
    console.log('─'.repeat(80));

    // 最新のcontractsを取得
    const contracts = await db.all(`
      SELECT id, contract_id, file_name, total_sheets, completed_sheets, status, uploaded_at
      FROM contracts
      ORDER BY uploaded_at DESC
      LIMIT 10
    `);

    if (contracts.length === 0) {
      console.log('❌ アップロード済み契約書なし');
      return;
    }

    for (const contract of contracts) {
      console.log(`\n契約書ID: ${contract.contract_id}`);
      console.log(`  ファイル: ${contract.file_name}`);
      console.log(`  総シート数: ${contract.total_sheets}`);
      console.log(`  完了シート数: ${contract.completed_sheets}`);
      console.log(`  ステータス: ${contract.status}`);
      console.log(`  アップロード日時: ${contract.uploaded_at}`);

      // 対応するシートを取得
      const sheets = await db.all(`
        SELECT cs.id, cs.sheet_name, cs.status, u.full_name, u.employee_id
        FROM contract_sheets cs
        LEFT JOIN users u ON cs.user_id = u.id
        WHERE cs.contract_id = ?
        ORDER BY cs.sheet_index ASC
      `, [contract.id]);

      if (sheets.length === 0) {
        console.log('  ❌ シートが割り当てられていません（マッチング失敗）');
      } else {
        console.log(`  📄 マッチング済みシート: ${sheets.length}件`);
        sheets.forEach((sheet, idx) => {
          console.log(`    ${idx + 1}. "${sheet.sheet_name}" → ${sheet.full_name} (${sheet.employee_id})`);
        });
      }
    }

    console.log('\n' + '─'.repeat(80));
    console.log('\n👥 登録済み従業員の確認:');
    const users = await db.all('SELECT full_name, last_name, employee_id FROM users');
    users.forEach(u => console.log(`  - ${u.full_name} (苗字: "${u.last_name}", ID: ${u.employee_id})`));

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

checkContracts();
