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

  // Excel または PDF ファイル/フォルダアップロード
  async uploadContract(req, res) {
    try {
      if (!req.files || (!req.files.file && !req.files.files)) {
        return res.status(400).json({ success: false, error: 'ファイルがアップロードされていません' });
      }

      const filesToProcess = req.files.files || req.files.file;
      const isMultiple = Array.isArray(filesToProcess);
      const firstFile = isMultiple ? filesToProcess[0] : filesToProcess;

      let originalName = '';
      try {
        originalName = Buffer.from(firstFile.originalname, 'latin1').toString('utf8');
      } catch (e) {
        originalName = firstFile.originalname;
      }

      const ext = path.extname(originalName).toLowerCase();
      const isPdf = ext === '.pdf';

      const contractId = `CTR-${Date.now()}`;
      const id = uuidv4();

      let sheetInfo = [];
      let totalSize = 0;
      let matchedSheets = [];

      if (!isPdf) {
        // --- 従来のエクセルアップロード処理 ---
        totalSize = firstFile.size;
        sheetInfo = await excelService.extractSheets(firstFile.path);
        console.log('\n📊 [Excel] 抽出されたシート:', JSON.stringify(sheetInfo, null, 2));

        // 契約書レコード作成
        await dbRun(
          `INSERT INTO contracts (id, contract_id, file_name, file_path, file_size, uploaded_by, total_sheets, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, contractId, originalName, firstFile.path, totalSize, '00000000-0000-0000-0000-000000000000', sheetInfo.length, 'in_progress']
        );

        for (let i = 0; i < sheetInfo.length; i++) {
          const sheet = sheetInfo[i];
          const sheetId = uuidv4();
          const employeeName = sheet.employeeName || sheet.name;
          const sheetNameExtracted = sheet.sheetNameExtracted;

          const user = await findUserByNameMatch(employeeName, sheetNameExtracted);

          if (user) {
            await dbRun(
              `INSERT INTO contract_sheets (id, contract_id, user_id, sheet_name, sheet_index, status) VALUES (?, ?, ?, ?, ?, ?)`,
              [sheetId, id, user.id, sheet.name, i, 'pending']
            );
            matchedSheets.push({ sheet_id: sheetId, sheet_name: sheet.name, employee_id: user.employee_id, full_name: user.full_name, email: user.email, status: 'matched' });
            await sendLineNotification(user, sheet.name);
          } else {
            matchedSheets.push({ sheet_name: sheet.name, employee_name: employeeName, status: 'unmatched', message: '従業員が見つかりません' });
          }
        }
      } else {
        // --- PDFフォルダ/複数アップロード処理 ---
        const pdfFiles = isMultiple ? filesToProcess : [firstFile];
        sheetInfo = pdfFiles.map(f => ({ name: f.originalname, file: f }));
        totalSize = pdfFiles.reduce((sum, f) => sum + f.size, 0);

        // バッチ(フォルダ)全体で1つの契約書レコードを作成
        await dbRun(
          `INSERT INTO contracts (id, contract_id, file_name, file_path, file_size, uploaded_by, total_sheets, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, contractId, isMultiple ? 'PDFフォルダ一括アップロード' : originalName, isMultiple ? 'multiple_files' : firstFile.path, totalSize, '00000000-0000-0000-0000-000000000000', pdfFiles.length, 'in_progress']
        );

        for (let i = 0; i < pdfFiles.length; i++) {
          const currentPdf = pdfFiles[i];
          const sheetId = uuidv4();

          let pdfOriginalName = currentPdf.originalname;
          try {
            pdfOriginalName = Buffer.from(pdfOriginalName, 'latin1').toString('utf8');
          } catch (e) { }

          // PDFのファイル名（拡張子抜き）から従業員名を推測する
          const nameWithoutExt = path.basename(pdfOriginalName, path.extname(pdfOriginalName));
          const employeeName = nameWithoutExt.replace(/\s+/g, '').replace(/　+/g, ''); // スペース除去

          const user = await findUserByNameMatch(nameWithoutExt, null);

          if (user) {
            // contract_sheets.sheet_name にはファイルパスを保存してPDFを開けるようにする、または別にカラムを作る。
            // sheet_name は画面表示名として使うので拡張子付きか抜きにする。 PDF表示用に full_path も保持するハックとして sheet_name の代わりに sheet_indexを活用するか...
            // または、この実装では一旦 file_path は使わず sheet_name に保存し、 employee.js 側で currentPdf.path を参照するため DB を拡張？
            // 簡単のため、すでに存在する `content_html` 的なフィールドか、`sheet_name` に文字列を入れておく？いや、`sheet_name` には画面用の名を入れて、実ファイルは `contracts.file_path` が使われる。
            // 複数ファイルがある場合、個別の `file_path` をどう保存するか？実はDBスキーマに `contract_sheets` の `sheet_name` にパスを含める手がある。
            // ひとまず `sheet_index` にファイル名(フルパス)の相対部分か絶対パス、または別DB改修が不要な方法にする。 `contract_sheets.custom_file_path`（なければエラーになる）。
            // DBを見ると `contract_sheets` には `sheet_name`, `sheet_index`, `status` がある。ここでは `sheet_name` には元のファイル名を入れ、`sheet_index` に文字列でフルパスを入れちゃおう（SQLiteなら型無視できるが）。
            // 実際は `uploads/xxx.pdf` にあるので、ファイルパス自体は currentPdf.path。
            // とりあえず、`sheet_index` に保存しよう。もしくは、後から取得できるように `sheet_name` を元に探す。

            // 安全な方法: sheet_index に JSONやファイル名を入れておく。実は integer フィールドかもしれない。
            // 最善のアプローチ： `contracts.file_path` が複数対応してないのであれば、別のファイルに退避するか、今回は `sheet_index` に i を入れつつ、あとでファイルを取得できるようにする。
            // `currentPdf.filename` に multerで生成された実ファイル名が入っている。これを `sheet_name` に「画面用の名前||ファイル名」として入れる。
            const combinedSheetName = `${nameWithoutExt}||${currentPdf.filename}`;

            await dbRun(
              `INSERT INTO contract_sheets (id, contract_id, user_id, sheet_name, sheet_index, status) VALUES (?, ?, ?, ?, ?, ?)`,
              [sheetId, id, user.id, combinedSheetName, i, 'pending']
            );
            matchedSheets.push({ sheet_id: sheetId, sheet_name: nameWithoutExt, employee_id: user.employee_id, full_name: user.full_name, email: user.email, status: 'matched' });
            await sendLineNotification(user, 'PDF契約書');
          } else {
            matchedSheets.push({ sheet_name: pdfOriginalName, employee_name: nameWithoutExt, status: 'unmatched', message: '従業員が見つかりません' });
          }
        }
      }

      res.json({
        success: true,
        message: isPdf ? 'PDFファイルを処理しました' : 'Excel ファイルをアップロードしました',
        data: {
          contract_id: contractId,
          file_name: isMultiple ? 'PDF複数ファイル' : originalName,
          file_size: totalSize,
          total_sheets: sheetInfo.length,
          matched_sheets: matchedSheets.filter(s => s.status === 'matched').length,
          unmatched_sheets: matchedSheets.filter(s => s.status === 'unmatched').length,
          details: matchedSheets
        }
      });
    } catch (error) {
      console.error('❌ Error uploading contract:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // --- 共通のヘルパーメソッド ---
  async findUserByNameMatch(employeeName, sheetNameExtracted) {
    const searchName = employeeName.replace(/\s+/g, '').replace(/　+/g, '');
    let user = await dbGet(`SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE full_name = ?`, [employeeName]);
    if (!user) user = await dbGet(`SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE REPLACE(REPLACE(full_name, ' ', ''), '　', '') = ?`, [searchName]);
    if (!user) user = await dbGet(`SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE full_name LIKE ?`, [`%${employeeName}%`]);
    if (!user) user = await dbGet(`SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE last_name = ? OR last_name LIKE ?`, [employeeName, `%${employeeName}%`]);
    if (!user) user = await dbGet(`SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE first_name = ? OR first_name LIKE ?`, [employeeName, `%${employeeName}%`]);
    if (!user && sheetNameExtracted) {
      user = await dbGet(`SELECT id, full_name, employee_id, email, line_user_id FROM users WHERE last_name = ?`, [sheetNameExtracted]);
    }
    return user;
  }

  async sendLineNotification(user, docName) {
    if (user.line_user_id) {
      try {
        const axios = (await import('axios')).default;
        await axios.post('https://api.line.me/v2/bot/message/push', {
          to: user.line_user_id,
          messages: [{
            type: 'text',
            text: `【契約書のお知らせ】\n${user.full_name}さん\n新しい雇用契約書（${docName}）が発行されました。アプリにログインして内容を確認し、署名をお願いします。\n\n▼確認・署名はこちら\n${process.env.PWA_URL || 'http://localhost:5173'}/contracts`
          }]
        }, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LINE_MESSAGING_ACCESS_TOKEN}` }
        });
      } catch (e) { }
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
