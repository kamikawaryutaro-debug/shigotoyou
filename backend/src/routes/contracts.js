import express from 'express';
import multer from 'multer';
import path from 'path';
import contractController from '../controllers/contractController.js';

const router = express.Router();

// ディスクではなくメモリに保存し、S3への手動アップロードに備える
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    let originalName;
    try {
      originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {
      originalName = file.originalname;
    }

    if (!originalName.toLowerCase().endsWith('.xls') &&
      !originalName.toLowerCase().endsWith('.xlsx') &&
      !originalName.toLowerCase().endsWith('.xlsm')) {
      originalName = file.originalname;
    }

    const allowedExt = ['.xlsx', '.xls', '.xlsm', '.pdf'];
    const ext = path.extname(originalName).toLowerCase();

    console.log(\`[Upload Filter] raw: \${file.originalname}, parsed: \${originalName}, ext: \${ext}\`);

    if (allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(\`Excel（.xlsx, .xls, .xlsm）または PDF ファイル（.pdf）のみ対応。認識された拡張子: \${ext}\`));
    }
  }
});

// ルート定義
// GET: 全契約書取得
router.get('/', (req, res) => contractController.getContracts(req, res));

// POST: Excel または PDF ファイルアップロード
router.post('/upload', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'files' }]), (req, res) => contractController.uploadContract(req, res));

// GET: 特定の契約書詳細
router.get('/:id', (req, res) => contractController.getContractDetail(req, res));

// GET: 契約書シート一覧
router.get('/:contractId/sheets', (req, res) => contractController.getContractSheets(req, res));

export default router;
