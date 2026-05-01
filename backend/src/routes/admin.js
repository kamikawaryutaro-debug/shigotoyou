import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbQuery, dbGet } from '../db.js';
import pdfService from '../services/pdfService.js';
import excelService from '../services/excelService.js';
import path from 'path';

const router = express.Router();

/**
 * GET /api/admin/stats
 * ダッシュボード統計情報
 */
router.get('/stats', async (req, res) => {
  try {
    const totalContracts = await dbGet('SELECT COUNT(*) as count FROM contracts');
    const totalSheets = await dbGet('SELECT COUNT(*) as count FROM contract_sheets');
    const signedSheets = await dbGet("SELECT COUNT(*) as count FROM contract_sheets WHERE status = 'signed'");
    const pendingSheets = await dbGet("SELECT COUNT(*) as count FROM contract_sheets WHERE status IN ('pending', 'sent', 'viewed')");
    const totalUsers = await dbGet("SELECT COUNT(*) as count FROM users WHERE status = 'active'");

    const signed = signedSheets?.count || 0;
    const total = totalSheets?.count || 0;
    const percentage = total > 0 ? Math.round((signed / total) * 100) : 0;

    res.json({
      success: true,
      data: {
        total_contracts: totalContracts?.count || 0,
        total_sheets: total,
        signed_sheets: signed,
        pending_sheets: pendingSheets?.count || 0,
        completion_rate: percentage,
        total_users: totalUsers?.count || 0
      }
    });
  } catch (error) {
    console.error('❌ 統計取得エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/signatures
 * 全署名一覧（フィルタ対応）
 */
router.get('/signatures', async (req, res) => {
  try {
    const { status } = req.query; // 'signed', 'pending', 'all'

    let whereClause = '';
    if (status === 'signed') {
      whereClause = "WHERE cs.status = 'signed'";
    } else if (status === 'pending') {
      whereClause = "WHERE cs.status IN ('pending', 'sent', 'viewed')";
    }

    const sheets = await dbQuery(
      `SELECT 
        cs.id as sheet_id,
        cs.sheet_name,
        cs.status,
        cs.sent_at,
        cs.viewed_at,
        cs.signed_at,
        cs.created_at,
        c.contract_id,
        c.file_name,
        c.uploaded_at,
        u.full_name,
        u.employee_id,
        u.email,
        u.position,
        u.department
      FROM contract_sheets cs
      JOIN contracts c ON cs.contract_id = c.id
      LEFT JOIN users u ON cs.user_id = u.id
      ${whereClause}
      ORDER BY cs.created_at DESC`
    );

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
    console.error('❌ 署名一覧取得エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/signatures/:sheetId
 * 署名詳細（署名画像データ含む）
 */
router.get('/signatures/:sheetId', async (req, res) => {
  try {
    const { sheetId } = req.params;

    const sheet = await dbGet(
      `SELECT 
        cs.*,
        c.contract_id,
        c.file_name,
        c.file_path,
        c.uploaded_at,
        u.full_name,
        u.employee_id,
        u.email,
        u.position,
        u.department
      FROM contract_sheets cs
      JOIN contracts c ON cs.contract_id = c.id
      LEFT JOIN users u ON cs.user_id = u.id
      WHERE cs.id = ?`,
      [sheetId]
    );

    if (!sheet) {
      return res.status(404).json({ success: false, error: '署名情報が見つかりません' });
    }

    // 署名データ取得
    const signature = await dbGet(
      `SELECT * FROM signatures WHERE contract_sheet_id = ? ORDER BY signed_at DESC LIMIT 1`,
      [sheetId]
    );

    // 契約書のHTML内容を取得（署名画像があれば埋め込み）
    let htmlContent = null;
    try {
      if (sheet.file_path && sheet.sheet_name && sheet.file_path !== 'multiple_files') {
        // 署名データがあればHTML生成時に埋め込む
        const sigData = (signature && signature.signature_data) ? signature.signature_data : null;
        const result = await excelService.getSheetHtml(sheet.file_path, sheet.sheet_name, sigData);
        htmlContent = result.html;
      }
    } catch (err) {
      console.warn('⚠️ 管理画面用HTML取得失敗:', err.message);
    }

    res.json({
      success: true,
      data: {
        sheet,
        signature: signature || null,
        htmlContent: htmlContent
      }
    });
  } catch (error) {
    console.error('❌ 署名詳細取得エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/signatures/:sheetId/pdf
 * 署名を合成したPDFをダウンロード
 */
router.get('/signatures/:sheetId/pdf', async (req, res) => {
  try {
    const { sheetId } = req.params;

    // シート情報と元のExcelパスを取得
    const sheet = await dbGet(
      `SELECT cs.*, c.file_path, c.file_name, u.full_name
       FROM contract_sheets cs
       JOIN contracts c ON cs.contract_id = c.id
       LEFT JOIN users u ON cs.user_id = u.id
       WHERE cs.id = ?`,
      [sheetId]
    );

    if (!sheet) {
      return res.status(404).json({ success: false, error: '署名情報が見つかりません' });
    }

    if (sheet.status !== 'signed') {
      return res.status(400).json({ success: false, error: 'この書類はまだ署名されていません' });
    }

    // 署名データ取得
    const signature = await dbGet(
      `SELECT signature_data FROM signatures WHERE contract_sheet_id = ? ORDER BY signed_at DESC LIMIT 1`,
      [sheetId]
    );

    if (!signature || !signature.signature_data) {
      return res.status(404).json({ success: false, error: '署名画像が見つかりません' });
    }

    // 署名済みPDFを生成
    const pdfBuffer = await pdfService.createSignedPdf(
      sheet.file_path,
      sheet.sheet_name,
      signature.signature_data
    );

    const downloadName = `signed_${sheet.full_name || 'employee'}_${sheet.file_name.replace('.xlsx', '.pdf')}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('❌ 署名済みPDF生成エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/users
 * 従業員一覧
 */
router.get('/users', async (req, res) => {
  try {
    const users = await dbQuery(
      `SELECT 
        id, employee_id, first_name, last_name, full_name, 
        email, phone, department, position, status, 
        line_user_id, created_at, last_login_at
      FROM users 
      ORDER BY created_at DESC`
    );

    res.json({ success: true, data: users, count: users.length });
  } catch (error) {
    console.error('❌ 従業員一覧取得エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users
 * 従業員新規作成
 */
router.post('/users', async (req, res) => {
  try {
    const { employee_id, first_name, last_name, email, phone, department, position } = req.body;

    if (!employee_id || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: '従業員ID、姓、名は必須です'
      });
    }

    // 重複チェック
    const existingId = await dbGet('SELECT id FROM users WHERE employee_id = ?', [employee_id]);
    if (existingId) {
      return res.status(409).json({
        success: false,
        error: '同じ従業員IDが既に登録されています'
      });
    }

    if (email) {
      const existingEmail = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: '同じメールアドレスが既に登録されています'
        });
      }
    }

    const id = uuidv4();
    const full_name = `${last_name} ${first_name}`;
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO users (id, employee_id, first_name, last_name, full_name, email, phone, department, position, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [id, employee_id, first_name, last_name, full_name, email || null, phone || null, department || null, position || null, now, now]
    );

    res.json({
      success: true,
      message: '従業員を登録しました',
      data: { id, employee_id, full_name, email }
    });
  } catch (error) {
    console.error('❌ 従業員作成エラー:', error);
    console.error('リクエストボディ:', req.body);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      detail: 'サーバー側でエラーが発生しました。データベースのスキーマ設定を確認してください。'
    });
  }
});

/**
 * PUT /api/admin/users/:id
 * 従業員編集
 */
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id, first_name, last_name, email, phone, department, position, status } = req.body;

    const user = await dbGet('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, error: '従業員が見つかりません' });
    }

    const full_name = `${last_name} ${first_name}`;
    const now = new Date().toISOString();

    await dbRun(
      `UPDATE users SET 
        employee_id = ?, first_name = ?, last_name = ?, full_name = ?,
        email = ?, phone = ?, department = ?, position = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [employee_id, first_name, last_name, full_name, email || null, phone || null, department || null, position || null, status || 'active', now, id]
    );

    res.json({
      success: true,
      message: '従業員情報を更新しました',
      data: { id, full_name, email }
    });
  } catch (error) {
    console.error('❌ 従業員更新エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * 従業員削除（論理削除）
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await dbGet('SELECT id, full_name FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, error: '従業員が見つかりません' });
    }

    await dbRun(
      "UPDATE users SET status = 'inactive', updated_at = ? WHERE id = ?",
      [new Date().toISOString(), id]
    );

    res.json({ success: true, message: `${user.full_name} を無効化しました` });
  } catch (error) {
    console.error('❌ 従業員削除エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * 従業員パスワードリセット（初回ログイン状態に戻す）
 */
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await dbGet('SELECT id, full_name, employee_id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, error: '従業員が見つかりません' });
    }

    await dbRun(
      'UPDATE users SET password_hash = NULL, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );

    console.log(`🔑 パスワードリセット: ${user.full_name} (${user.employee_id})`);

    res.json({
      success: true,
      message: `${user.full_name} のパスワードをリセットしました。次回ログイン時に新しいパスワードが設定されます。`
    });
  } catch (error) {
    console.error('❌ パスワードリセットエラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/contracts/:id
 * 契約書削除
 */
router.delete('/contracts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const contract = await dbGet('SELECT id, file_name FROM contracts WHERE id = ?', [id]);
    if (!contract) {
      return res.status(404).json({ success: false, error: '契約書が見つかりません' });
    }

    // 関連署名削除
    await dbRun(
      'DELETE FROM signatures WHERE contract_sheet_id IN (SELECT id FROM contract_sheets WHERE contract_id = ?)',
      [id]
    );
    // 関連シート削除
    await dbRun('DELETE FROM contract_sheets WHERE contract_id = ?', [id]);
    // 契約書削除
    await dbRun('DELETE FROM contracts WHERE id = ?', [id]);

    res.json({ success: true, message: `${contract.file_name} を削除しました` });
  } catch (error) {
    console.error('❌ 契約書削除エラー:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
