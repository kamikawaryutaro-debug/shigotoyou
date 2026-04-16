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
        // Windows: soffice.exe を使用
        command = `soffice --headless --convert-to pdf --outdir "${tempDir}" "${excelPath}"`;
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
