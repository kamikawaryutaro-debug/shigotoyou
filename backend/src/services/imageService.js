import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';

const execPromise = promisify(exec);

class ImageService {
  /**
   * ExcelをPNGスクリーンショットに変換（複数ページ対応）
   * @param {string} excelPath - Excelファイルのパス
   * @returns {Promise<Array>} ページ番号をキーとしたPNG画像バッファの配列
   */
  async convertExcelToImages(excelPath) {
    const tempDir = tmpdir();
    const timestamp = Date.now();
    const pdfFileName = `contract_${timestamp}.pdf`;
    const pdfPath = join(tempDir, pdfFileName);

    try {
      console.log(`📄 Excel→PDF変換開始: ${excelPath}`);

      // Step 1: LibreOffice でExcel→PDF
      const isWindows = process.platform === 'win32';
      let command;

      if (isWindows) {
        command = `soffice --headless --convert-to pdf --outdir "${tempDir}" "${excelPath}"`;
      } else {
        command = `libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${excelPath}"`;
      }

      console.log(`🔧 LibreOffice実行中...`);
      const { stdout, stderr } = await execPromise(command, {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024
      });

      if (stdout) console.log(`stdout: ${stdout}`);
      if (stderr) console.log(`stderr: ${stderr}`);

      console.log(`✅ PDF変換完了: ${pdfPath}`);

      // Step 2: PDF各ページを画像に変換
      const images = await this.convertPdfToImages(pdfPath);

      // 一時PDFファイルを削除
      try {
        await unlink(pdfPath);
      } catch (e) {
        console.warn(`⚠️ PDF削除スキップ: ${e.message}`);
      }

      return images;
    } catch (error) {
      console.error(`❌ Excel→画像変換エラー: ${error.message}`);

      // エラーメッセージの解析
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        throw new Error(
          'LibreOfficeがシステムにインストールされていません。' +
          'セットアップ手順を参照してください。'
        );
      }

      throw new Error(`Excel→画像変換エラー: ${error.message}`);
    }
  }

  /**
   * PDFをPNG画像の配列に変換（Ghostscript コマンド使用）
   * @param {string} pdfPath - PDFファイルのパス
   * @returns {Promise<Array>} ページごとのPNG画像バッファ配列
   */
  async convertPdfToImages(pdfPath) {
    const tempDir = tmpdir();
    const timestamp = Date.now();
    const imagePattern = join(tempDir, `contract_${timestamp}_page_%d.png`);

    try {
      console.log(`🖼️ PDF→PNG変換中: ${pdfPath}`);

      // Ghostscript コマンドでPDFを画像化
      // -dNOPAUSE: 各ページ処理後に一時停止しない
      // -r150: 解像度150DPI（高品質）
      // -sDEVICE=png16m: PNG出力
      const gsCommand = `gswin64c -dNOPAUSE -dBATCH -r150 -sDEVICE=png16m -sOutputFile="${imagePattern}" "${pdfPath}"`;

      console.log(`🔧 Ghostscript実行中...`);
      const { stdout, stderr } = await execPromise(gsCommand, {
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024
      });

      if (stdout) console.log(`stdout: ${stdout}`);
      if (stderr && !stderr.includes('GPL')) console.log(`stderr: ${stderr}`);

      // 生成されたPNGファイルを読み込み（ページ順）
      console.log(`📂 生成されたPNGを読み込み中...`);

      const images = [];
      let pageNum = 1;

      while (true) {
        const imagePath = imagePattern.replace('%d', pageNum);
        try {
          const imageBuffer = await readFile(imagePath);
          images.push({
            page: pageNum,
            buffer: imageBuffer,
            path: imagePath
          });
          pageNum++;
        } catch (e) {
          // ファイルが存在しない → 最後のページまで読み込んだ
          break;
        }
      }

      console.log(`✅ ${images.length} ページをPNG化完了`);

      return images;
    } catch (error) {
      console.error(`❌ PDF→PNG変換エラー: ${error.message}`);

      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        throw new Error(
          'Ghostscriptがインストールされていません。' +
          'Windows: https://www.ghostscript.com/download/gsdnld.html からダウンロードしてください。'
        );
      }

      throw new Error(`PDF→PNG変換エラー: ${error.message}`);
    }
  }

  /**
   * 最初のページをPNG画像として返す
   * @param {string} excelPath - Excelファイルのパス
   * @returns {Promise<Buffer>} PNGバッファ
   */
  async getFirstPageImage(excelPath) {
    const images = await this.convertExcelToImages(excelPath);

    if (images.length === 0) {
      throw new Error('一つもイメージが生成されませんでした。');
    }

    return images[0].buffer;
  }

  /**
   * すべてのページをBase64エンコードして返す
   * @param {string} excelPath - Excelファイルのパス
   * @returns {Promise<Array>} {page, base64} 配列
   */
  async getAllPagesAsBase64(excelPath) {
    const images = await this.convertExcelToImages(excelPath);

    const result = images.map(img => ({
      page: img.page,
      base64: img.buffer.toString('base64'),
      mimeType: 'image/png'
    }));

    // 一時ファイルをクリーンアップ
    for (const img of images) {
      try {
        await unlink(img.path);
      } catch (e) {
        console.warn(`⚠️ 一時ファイル削除スキップ: ${img.path}`);
      }
    }

    return result;
  }
}

export default new ImageService();
