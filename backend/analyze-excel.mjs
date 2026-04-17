import excelService from './src/services/excelService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 最新のアップロードされたExcelを分析
const latestFile = path.join(
  __dirname,
  'uploads',
  'パートタイム雇用契約書ひな形一例(清水)-1775251131036.xlsx'
);

console.log('\n🔍 Excelファイルを分析中...\n');
console.log(`ファイル: ${latestFile}\n`);

try {
  const sheets = await excelService.extractSheets(latestFile);
  console.log('📊 抽出されたシート情報:');
  console.log(JSON.stringify(sheets, null, 2));
  process.exit(0);
} catch (error) {
  console.error('❌ エラー:', error.message);
  process.exit(1);
}
