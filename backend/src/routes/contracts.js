import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import contractController from '../controllers/contractController.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// multer: ファイルアップロード設定
import fs from 'fs';
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
        // Accept decoded if it preserves .xls/.xlsx
        if (decoded.toLowerCase().endsWith('.xls') || decoded.toLowerCase().endsWith('.xlsx')) {
            originalName = decoded;
        }
    } catch(e) {}
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
    if (!originalName.toLowerCase().endsWith('.xls') && !originalName.toLowerCase().endsWith('.xlsx')) {
        originalName = file.originalname; // Revert to raw name if extension got broken
    }

    const allowedExt = ['.xlsx', '.xls'];
    const ext = path.extname(originalName).toLowerCase();
    
    console.log(`[Upload Filter] raw: ${file.originalname}, parsed: ${originalName}, ext: ${ext}`);
    
    if (allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Excel ファイル（.xlsx, .xls）のみ対応。認識された拡張子: ${ext}`));
    }
  }
});

// ルート定義
// GET: 全契約書取得
router.get('/', contractController.getContracts);

// POST: Excel ファイルアップロード
router.post('/upload', upload.single('file'), contractController.uploadContract);

// GET: 特定の契約書詳細
router.get('/:id', contractController.getContractDetail);

// GET: 契約書シート一覧
router.get('/:contractId/sheets', contractController.getContractSheets);

export default router;
