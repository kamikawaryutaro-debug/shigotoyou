import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbQuery, dbGet } from '../db.js';
import excelService from '../services/excelService.js';
import path from 'path';

class ContractController {
  // 全契約書取得
  async getContracts(req, res) {
    try {
      // 契約書一覧を取得（最初の従業員名も含める）
      const contracts = await dbQuery(
        `SELECT c.*, 
                (SELECT u.full_name FROM contract_sheets cs JOIN users u ON cs.user_id = u.id WHERE cs.contract_id = c.id LIMIT 1) as name,
                (SELECT u.position FROM contract_sheets cs JOIN users u ON cs.user_id = u.id WHERE cs.contract_id = c.id LIMIT 1) as position
         FROM contracts c 
         ORDER BY c.uploaded_at DESC 
         LIMIT 50`
      );
      res.json({ success: true, data: contracts, count: contracts.length });
    } catch (error) {
      console.error('Error fetching contracts:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Excel ファイルアップロード
  async uploadContract(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'ファイルがアップロードされていません' });
      }

      const { file } = req;
      const contractId = `CTR-${Date.now()}`;
      const id = uuidv4();

      // Excel ファイルからシート情報を抽出
      const sheetInfo = await excelService.extractSheets(file.path);
      console.log('📊 抽出されたシート:', sheetInfo);

      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

      // 契約書レコード作成
      await dbRun(
        `INSERT INTO contracts (id, contract_id, file_name, file_path, file_size, uploaded_by, total_sheets, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, contractId, originalName, file.path, file.size, '00000000-0000-0000-0000-000000000000', sheetInfo.length, 'in_progress']
      );

      // 各シートと従業員をマッチング
      const matchedSheets = [];
      for (let i = 0; i < sheetInfo.length; i++) {
        const sheet = sheetInfo[i];
        const sheetId = uuidv4();

        // シート名またはセルから抽出した従業員名
        const employeeName = sheet.employeeName || sheet.name;
        const sheetNameExtracted = sheet.sheetNameExtracted; // シート名から抽出した苗字

        console.log(`\n🔍 マッチング開始: "${employeeName}"`);
        console.log(`  📊 シート情報:`, JSON.stringify({
          employeeName: sheet.employeeName,
          sheetNameExtracted: sheet.sheetNameExtracted,
          sheetName: sheet.name
        }, null, 2));
        if (sheetNameExtracted && sheetNameExtracted !== employeeName) {
          console.log(`  📌 シート名バックアップ: "${sheetNameExtracted}"`);
        }

        // DB から従業員を検索（複数の方法で試行）
        let user = null;
        const searchName = employeeName.replace(/\s+/g, '').replace(/　+/g, ''); // スペース除去
        console.log(`  検索対象: "${employeeName}" (スペース除去: "${searchName}")`);

        // 方法1: フルネーム で完全一致
        user = await dbGet(
          `SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE full_name = ?`,
          [employeeName]
        );
        if (user) {
          console.log(`  ✅ 方法1（完全一致）でマッチ: ${user.full_name}`);
        } else {
          console.log(`  ❌ 方法1失敗: full_name = "${employeeName}"で見つかりません`);
        }

        // 方法2: フルネーム(スペース除去)で一致
        if (!user) {
          user = await dbGet(
            `SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE REPLACE(REPLACE(full_name, ' ', ''), '　', '') = ?`,
            [searchName]
          );
          if (user) {
            console.log(`  ✅ 方法2（スペース除去後の一致）でマッチ: ${user.full_name}`);
          } else {
            console.log(`  ❌ 方法2失敗: スペース除去後でも見つかりません`);
          }
        }

        // 方法2.5: シート名そのもの（スペース除去）でフルネーム一致
        if (!user && sheet.name) {
          const sheetSearchName = sheet.name.replace(/\s+/g, '').replace(/　+/g, '');
          user = await dbGet(
            `SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE REPLACE(REPLACE(full_name, ' ', ''), '　', '') = ?`,
            [sheetSearchName]
          );
          if (user) {
            console.log(`  ✅ 方法2.5（シート名完全一致）でマッチ: ${user.full_name}`);
          }
        }

        // 方法3: フルネーム部分マッチ
        if (!user) {
          user = await dbGet(
            `SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE full_name LIKE ?`,
            [`%${employeeName}%`]
          );
          if (user) {
            console.log(`  ✅ 方法3（フルネーム部分マッチ）でマッチ: ${user.full_name}`);
          } else {
            console.log(`  ❌ 方法3失敗: フルネーム部分マッチで見つかりません`);
          }
        }

        // 方法4: ラスト名（苗字）で検索
        if (!user) {
          user = await dbGet(
            `SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE last_name LIKE ? OR last_name = ?`,
            [`%${employeeName}%`, employeeName]
          );
          if (user) {
            console.log(`  ✅ 方法4（苗字マッチ）でマッチ: ${user.full_name}`);
          } else {
            console.log(`  ❌ 方法4失敗: 苗字検索で見つかりません`);
          }
        }

        // 方法5: ファースト名で検索
        if (!user) {
          user = await dbGet(
            `SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE first_name LIKE ? OR first_name = ?`,
            [`%${employeeName}%`, employeeName]
          );
          if (user) {
            console.log(`  ✅ 方法5（名前マッチ）でマッチ: ${user.full_name}`);
          } else {
            console.log(`  ❌ 方法5失敗: 名前検索で見つかりません`);
          }
        }

        // 方法6: シート名から抽出した苗字を使用した強制マッチング
        // （重要：シート名が確実な情報源なので、これを優先度最高にする）
        let userFromSheetName = null;
        if (sheetNameExtracted) {
          console.log(`\n  🚨 重要マッチング: シート名から抽出した苗字 "${sheetNameExtracted}" で確実に検索します`);

          userFromSheetName = await dbGet(
            `SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE last_name = ?`,
            [sheetNameExtracted]
          );

          if (userFromSheetName) {
            console.log(`  ✅ シート名マッチング成功: ${userFromSheetName.full_name} (${userFromSheetName.employee_id})`);
            user = userFromSheetName; // これを優先する
          } else {
            console.log(`  ❌ シート名マッチング失敗: last_name = "${sheetNameExtracted}" で見つかりません`);
            console.log(`    📋 登録済み苗字一括確認:`);
            const allUsers = await dbQuery('SELECT last_name FROM users GROUP BY last_name');
            allUsers.forEach(u => console.log(`       - "${u.last_name}"`));
          }
        }

        if (user) {
          // シート と 従業員をリンク
          await dbRun(
            `INSERT INTO contract_sheets (id, contract_id, user_id, sheet_name, sheet_index, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [sheetId, id, user.id, sheet.name, i, 'pending']
          );

          matchedSheets.push({
            sheet_id: sheetId,
            sheet_name: sheet.name,
            employee_id: user.employee_id,
            full_name: user.full_name,
            email: user.email,
            status: 'matched'
          });

          console.log(`✅ マッチング成功: ${sheet.name} → ${user.full_name}`);

          // LINE通知を送信
          if (user.line_user_id) {
            try {
              const axios = (await import('axios')).default;
              await axios.post('https://api.line.me/v2/bot/message/push', {
                to: user.line_user_id,
                messages: [{
                  type: 'text',
                  text: `【契約書のお知らせ】\n${user.full_name}さん\n新しい雇用契約書（${sheet.name}）が発行されました。アプリにログインして内容を確認し、署名をお願いします。\n\n▼確認・署名はこちら\n${process.env.PWA_URL || 'http://localhost:5173'}/contracts`
                }]
              }, {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${process.env.LINE_MESSAGING_ACCESS_TOKEN}`
                }
              });
              console.log(`  📲 LINE通知を送信しました`);
            } catch (lineErr) {
              console.error(`  ⚠️ LINE通知送信に失敗 (${user.full_name}):`, lineErr.response?.data || lineErr.message);
            }
          }
        } else {
          const failureDetails = `検索名: "${employeeName}"`;
          const detailsWithSheetName = sheetNameExtracted && sheetNameExtracted !== employeeName
            ? `${failureDetails}, シート名から: "${sheetNameExtracted}"`
            : failureDetails;

          matchedSheets.push({
            sheet_name: sheet.name,
            employee_name: employeeName,
            sheetNameExtracted: sheetNameExtracted,
            status: 'unmatched',
            message: `従業員が見つかりません: ${detailsWithSheetName}`
          });

          console.log(`❌ マッチング失敗: ${sheet.name} → ${detailsWithSheetName}`);
        }
      }

      res.json({
        success: true,
        message: 'Excel ファイルをアップロードしました',
        data: {
          contract_id: contractId,
          file_name: originalName,
          file_size: file.size,
          total_sheets: sheetInfo.length,
          matched_sheets: matchedSheets.filter(s => s.status === 'matched').length,
          unmatched_sheets: matchedSheets.filter(s => s.status === 'unmatched').length,
          details: matchedSheets
        }
      });
    } catch (error) {
      console.error('❌ Error uploading contract:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // 特定の契約書詳細
  async getContractDetail(req, res) {
    try {
      const { id } = req.params;
      const contract = await dbGet('SELECT * FROM contracts WHERE id = ?', [id]);

      if (!contract) {
        return res.status(404).json({ success: false, error: '契約書が見つかりません' });
      }

      const sheets = await dbQuery(
        `SELECT cs.*, u.full_name, u.email FROM contract_sheets cs
         LEFT JOIN users u ON cs.user_id = u.id
         WHERE cs.contract_id = ?`,
        [id]
      );

      res.json({
        success: true,
        data: {
          contract,
          sheets,
          progress: {
            total: contract.total_sheets,
            completed: contract.completed_sheets,
            percentage: contract.total_sheets > 0 ? Math.round((contract.completed_sheets / contract.total_sheets) * 100) : 0
          }
        }
      });
    } catch (error) {
      console.error('Error fetching contract detail:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // 契約書シート一覧
  async getContractSheets(req, res) {
    try {
      const { contractId } = req.params;
      const sheets = await dbQuery(
        `SELECT cs.*, u.full_name, u.email, c.contract_id FROM contract_sheets cs
         LEFT JOIN users u ON cs.user_id = u.id
         JOIN contracts c ON cs.contract_id = c.id
         WHERE c.contract_id = ?
         ORDER BY cs.created_at ASC`,
        [contractId]
      );

      res.json({ success: true, data: sheets });
    } catch (error) {
      console.error('Error fetching sheets:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new ContractController();
