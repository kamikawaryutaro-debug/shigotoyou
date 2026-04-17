import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbQuery, dbGet } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import excelService from '../services/excelService.js';
import pdfService from '../services/pdfService.js';
import imageService from '../services/imageService.js';

const router = express.Router();

// 全ルートで認証必須
router.use(authenticate);

/**
 * GET /api/employee/contracts
 * 自分宛ての契約書シート一覧
 */
router.get('/contracts', async (req, res) => {
  try {
    const sheets = await dbQuery(
      `SELECT 
        cs.id as sheet_id,
        cs.sheet_name,
        cs.status,
        cs.sent_at,
        cs.viewed_at,
        cs.signed_at,
        c.contract_id,
        c.file_name,
        c.uploaded_at
      FROM contract_sheets cs
      JOIN contracts c ON cs.contract_id = c.id
      WHERE cs.user_id = ?
      ORDER BY cs.created_at DESC`,
      [req.user.id]
    );

    // ステータスの日本語化
    const formattedSheets = sheets.map(sheet => ({
      ...sheet,
      status_text: getStatusText(sheet.status),
      status_color: getStatusColor(sheet.status)
    }));

    res.json({
      success: true,
      data: formattedSheets,
      count: formattedSheets.length
    });
  } catch (error) {
    console.error('❌ 契約書一覧取得エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/employee/contracts/:sheetId
 * 契約書シート詳細（内容表示用）
 */
router.get('/contracts/:sheetId', async (req, res) => {
  try {
    const { sheetId } = req.params;

    const sheet = await dbGet(
      `SELECT 
        cs.*,
        c.contract_id,
        c.file_name,
        c.file_path,
        c.uploaded_at
      FROM contract_sheets cs
      JOIN contracts c ON cs.contract_id = c.id
      WHERE cs.id = ? AND cs.user_id = ?`,
      [sheetId, req.user.id]
    );

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: '契約書が見つかりません。'
      });
    }

    // ExcelからシートデータをHTMLとして取得（見た目そのまま）
    let sheetData = null;
    try {
      if (sheet.file_path && sheet.sheet_name) {
        sheetData = await excelService.getSheetHtml(sheet.file_path, sheet.sheet_name);
      }
    } catch (err) {
      console.warn('⚠️ シートHTML読み込みスキップ:', err.message);
    }

    // 閲覧日時を記録（初回のみ）
    if (!sheet.viewed_at) {
      await dbRun(
        'UPDATE contract_sheets SET viewed_at = ?, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), new Date().toISOString(), sheetId]
      );

      // 監査ログ
      await dbRun(
        `INSERT INTO audit_logs (id, user_id, action, target_type, target_id, description, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(), req.user.id, 'VIEW_CONTRACT', 'contract_sheet', sheetId,
          `${req.user.full_name} が契約書を閲覧しました`,
          req.ip, req.headers['user-agent']
        ]
      );
    }

    res.json({
      success: true,
      data: {
        sheet_id: sheet.id,
        contract_id: sheet.contract_id,
        sheet_name: sheet.sheet_name,
        file_name: sheet.file_name,
        status: sheet.status,
        status_text: getStatusText(sheet.status),
        uploaded_at: sheet.uploaded_at,
        viewed_at: sheet.viewed_at || new Date().toISOString(),
        signed_at: sheet.signed_at,
        sheet_data: sheetData
      }
    });
  } catch (error) {
    console.error('❌ 契約書詳細取得エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/employee/contracts/:sheetId/download
 * 従業員個人のシートのみを含むExcelファイルをダウンロード
 */
router.get('/contracts/:sheetId/download', async (req, res) => {
  try {
    const { sheetId } = req.params;

    const sheet = await dbGet(
      `SELECT c.file_path, c.file_name, cs.sheet_name
       FROM contract_sheets cs
       JOIN contracts c ON cs.contract_id = c.id
       WHERE cs.id = ? AND cs.user_id = ?`,
      [sheetId, req.user.id]
    );

    if (!sheet || !sheet.file_path) {
      return res.status(404).json({ success: false, error: 'ファイルが見つかりません。' });
    }

    try {
      // 指定したシートのみを含む新しいExcelのバッファを生成
      const buffer = await excelService.getSingleSheetExcelBuffer(sheet.file_path, sheet.sheet_name);
      
      const fileName = `${sheet.sheet_name}_${sheet.file_name}`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.send(buffer);
    } catch (excelError) {
      console.warn('⚠️ 個別シート抽出失敗、フォールバックとして元ファイルを送信します:', excelError.message);
      res.download(sheet.file_path, sheet.file_name);
    }
  } catch (error) {
    console.error('❌ ファイルダウンロードエラー:', error);
    res.status(500).json({ success: false, error: 'ダウンロードに失敗しました。' });
  }
});

/**
 * POST /api/employee/contracts/:sheetId/sign
 * 署名送信
 */
router.post('/contracts/:sheetId/sign', async (req, res) => {
  try {
    const { sheetId } = req.params;
    const { signature_data } = req.body;

    if (!signature_data) {
      return res.status(400).json({
        success: false,
        error: '署名データが必要です。'
      });
    }

    // 自分のシートか確認
    const sheet = await dbGet(
      `SELECT cs.*, c.id as c_id, c.total_sheets, c.completed_sheets
       FROM contract_sheets cs
       JOIN contracts c ON cs.contract_id = c.id
       WHERE cs.id = ? AND cs.user_id = ?`,
      [sheetId, req.user.id]
    );

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: '契約書が見つかりません。'
      });
    }

    if (sheet.status === 'signed') {
      return res.status(400).json({
        success: false,
        error: 'この契約書は既に署名済みです。'
      });
    }

    const now = new Date().toISOString();
    const signatureId = uuidv4();

    // 署名レコード作成
    await dbRun(
      `INSERT INTO signatures (id, contract_sheet_id, user_id, signature_data, signed_at, ip_address, device_os, browser_user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        signatureId, sheetId, req.user.id, signature_data,
        now, req.ip,
        req.body.device_os || 'unknown',
        req.headers['user-agent']
      ]
    );

    // シートステータス更新
    await dbRun(
      'UPDATE contract_sheets SET status = ?, signed_at = ?, updated_at = ? WHERE id = ?',
      ['signed', now, now, sheetId]
    );

    // 契約書の完了数を更新
    await dbRun(
      'UPDATE contracts SET completed_sheets = completed_sheets + 1, updated_at = ? WHERE id = ?',
      [now, sheet.c_id]
    );

    // 全シート完了か確認
    const updatedContract = await dbGet(
      'SELECT total_sheets, completed_sheets FROM contracts WHERE id = ?',
      [sheet.c_id]
    );

    if (updatedContract && updatedContract.completed_sheets >= updatedContract.total_sheets) {
      await dbRun(
        'UPDATE contracts SET status = ?, updated_at = ? WHERE id = ?',
        ['completed', now, sheet.c_id]
      );
    }

    // 監査ログ記録
    await dbRun(
      `INSERT INTO audit_logs (id, user_id, action, target_type, target_id, description, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), req.user.id, 'SIGN_CONTRACT', 'signature', signatureId,
        `${req.user.full_name} が契約書に署名しました（シート: ${sheet.sheet_name}）`,
        req.ip, req.headers['user-agent']
      ]
    );

    res.json({
      success: true,
      message: '署名が完了しました。',
      data: {
        signature_id: signatureId,
        signed_at: now,
        sheet_name: sheet.sheet_name
      }
    });
  } catch (error) {
    console.error('❌ 署名エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 注意: 以前のPDF変換や画像表示の試行（LibreOffice等が必要なもの）は削除されました
// 現在は「方針案A（単独シートのエクセルを直接ダウンロード）」に統一されています。

// ヘルパー関数
function getStatusText(status) {
  const map = {
    'pending': '署名待ち',
    'sent': '配布済み',
    'viewed': '閲覧済み',
    'signed': '署名完了',
    'completed': '完了'
  };
  return map[status] || status;
}

function getStatusColor(status) {
  const map = {
    'pending': '#faad14',
    'sent': '#1890ff',
    'viewed': '#722ed1',
    'signed': '#52c41a',
    'completed': '#52c41a'
  };
  return map[status] || '#999';
}

export default router;
