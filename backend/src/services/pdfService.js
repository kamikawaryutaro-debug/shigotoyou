import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execPromise = promisify(exec);

class PdfService {
  /**
   * ExcelファイルをPDFに変換（LibreOfficeを使用）
   * @param {string} excelPath - Excelファイルのパス
   * @returns {Promise<Buffer>} PDFファイルのバッファ
   */
  async convertExcelToPdf(excelPath) {
    const tempDir = tmpdir();
    const outputFileName = `contract_${Date.now()}.pdf`;
    const outputPath = join(tempDir, outputFileName);

    try {
      console.log(`📄 PDF変換開始: ${excelPath}`);

      // LibreOffice コマンド（Windowsとまたはそれ以外）
      const isWindows = process.platform === 'win32';
      let command;

      if (isWindows) {
        // 標準的なインストールパスを確認
        const standardPath = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

        // ファイル存在確認
        try {
          const fs = await import('fs/promises');
          await fs.access(standardPath);
        } catch (e) {
          throw new Error('LibreOffice が C:\\Program Files\\LibreOffice に見つかりません。PDF出力機能は無効です。');
        }

        command = `"${standardPath}" --headless --convert-to pdf --outdir "${tempDir}" "${excelPath}"`;
      } else {
        // Linux/Mac: soffice または libreoffice
        command = `libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${excelPath}"`;
      }

      console.log(`🔧 実行コマンド: ${command}`);

      const { stdout, stderr } = await execPromise(command, {
        timeout: 60000, // 60秒タイムアウト
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });

      console.log(`✅ PDF変換完了`);
      if (stdout) console.log(`stdout: ${stdout}`);
      if (stderr) console.log(`stderr: ${stderr}`);

      // 生成されたPDFを読み込み
      const pdfBuffer = await readFile(outputPath);

      // 一時ファイルを削除
      await unlink(outputPath);

      return pdfBuffer;
    } catch (error) {
      console.error(`❌ PDF変換エラー: ${error.message}`);

      // LibreOfficeがインストールされていない場合のエラーハンドリング
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        throw new Error(
          'LibreOfficeがシステムにインストールされていません。' +
          'Windows: https://www.libreoffice.org/downloads/ からダウンロードしてください。'
        );
      }

      throw new Error(`PDF変換エラー: ${error.message}`);
    }
  }

  /**
   * 署名を埋め込んだ契約書PDFを作成
   * @param {string} excelPath - 元のExcelファイルのパス
   * @param {string} sheetName - 署名を埋め込むシート名
   * @param {string} signatureBase64 - 署名画像（Base64）
   * @returns {Promise<Buffer>} 署名済みPDFのバッファ
   */
  async createSignedPdf(excelPath, sheetName, signatureBase64) {
    const exceljs = (await import('exceljs')).default;
    const fs = await import('fs/promises');
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.readFile(excelPath);

    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      throw new Error(`シート '${sheetName}' が見つかりません`);
    }

    // 署名画像をExcelに追加
    const imageId = workbook.addImage({
      base64: signatureBase64,
      extension: 'png',
    });

    // 署名の挿入位置を決定（とりあえずコンテンツの右端・下端付近）
    // 実際には「署名」ラベルを探すなどの高度な処理も可能だが、まずは標準的な位置へ
    const lastRow = Math.max(worksheet.lastRow?.number || 0, 15);
    const lastCol = Math.max(worksheet.lastColumn?.number || 0, 5);

    worksheet.addImage(imageId, {
      tl: { col: Math.max(0, lastCol - 3), row: lastRow + 1 },
      ext: { width: 180, height: 80 }
    });

    // 一時的な署名済みExcelとして保存
    const tempExcelPath = join(tmpdir(), `signed_temp_${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(tempExcelPath);

    try {
      // PDFに変換
      const pdfBuffer = await this.convertExcelToPdf(tempExcelPath);

      // 一時Excelを削除
      await unlink(tempExcelPath).catch(() => { });

      return pdfBuffer;
    } catch (err) {
      await unlink(tempExcelPath).catch(() => { });
      throw err;
    }
  }

  /**
   * ExcelファイルをPDFに変換してBase64エンコード
   * @param {string} excelPath - Excelファイルのパス
   * @returns {Promise<string>} Base64エンコードされたPDFデータ
   */
  async convertExcelToPdfBase64(excelPath) {
    try {
      const pdfBuffer = await this.convertExcelToPdf(excelPath);
      return pdfBuffer.toString('base64');
    } catch (error) {
      console.error('❌ Base64 エンコードエラー:', error);
      throw error;
    }
  }
}

export default new PdfService();
