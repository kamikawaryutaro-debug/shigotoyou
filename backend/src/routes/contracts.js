import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import contractController from '../controllers/contractController.js';
import fs from 'fs';

const router = express.Router();
const uploadsDir = path.join(process.cwd(), 'uploads');

// アップロード用ディレクトリが存在しない場合は作成
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    let originalName = file.originalname;
    try {
      const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
      // Accept decoded if it preserves .xls/.xlsx/.xlsm
      if (decoded.toLowerCase().endsWith('.xls') ||
        decoded.toLowerCase().endsWith('.xlsx') ||
        decoded.toLowerCase().endsWith('.xlsm')) {
        originalName = decoded;
      }
    } catch (e) { }
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    cb(null, `${name}-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    let originalName;
    try {
      originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {
      originalName = file.originalname;
    }

    // Fallback if originalName getting corrupted
    if (!originalName.toLowerCase().endsWith('.xls') &&
      !originalName.toLowerCase().endsWith('.xlsx') &&
      !originalName.toLowerCase().endsWith('.xlsm')) {
      originalName = file.originalname; // Revert to raw name if extension got broken
    }

    const allowedExt = ['.xlsx', '.xls', '.xlsm', '.pdf'];
    const ext = path.extname(originalName).toLowerCase();

    console.log(`[Upload Filter] raw: ${file.originalname}, parsed: ${originalName}, ext: ${ext}`);

    if (allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Excel（.xlsx, .xls, .xlsm）または PDF ファイル（.pdf）のみ対応。認識された拡張子: ${ext}`));
    }
  }
});

// ルート定義
// GET: 全契約書取得
router.get('/', contractController.getContracts);

// POST: Excel または PDF ファイルアップロード
router.post('/upload', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'files' }]), contractController.uploadContract);

// GET: 特定の契約書詳細
router.get('/:id', contractController.getContractDetail);

// GET: 契約書シート一覧
router.get('/:contractId/sheets', contractController.getContractSheets);

export default router;
