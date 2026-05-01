import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

class ExcelService {
  // Excelファイルからシート情報を抽出
  async extractSheets(filePath) {
    try {
      const workbook = await this._getWorkbook(filePath);
      const sheets = [];

      for (let i = 0; i < workbook.worksheets.length; i++) {
        const worksheet = workbook.worksheets[i];
        const sheetName = worksheet.name;

        // 従業員名の抽出
        let employeeName = '';
        let candidates = [];
        const cellsToCheck = ['P4', 'CI2', 'A4', 'B4', 'A3', 'B3', 'A2', 'B2', 'A5', 'B5'];

        console.log(`\n🔎 シート ${i + 1} "${sheetName}" の従業員名を検索中...`);

        for (const cellRef of cellsToCheck) {
          try {
            const cell = worksheet.getCell(cellRef);
            let cellValue = '';

            if (cell) {
              if (cell.value && typeof cell.value !== 'object') {
                cellValue = String(cell.value).trim();
              } else if (cell.result) {
                cellValue = String(cell.result).trim();
              } else if (cell.value && cell.value.richText) {
                cellValue = cell.value.richText.map(rt => rt.text || '').join('').trim();
              }
            }

            if (cellValue && cellValue.length >= 2 && cellValue.length < 30) {
              const hasKanji = /[\u4E00-\u9FFF]/.test(cellValue);
              const hasKana = /[\u3041-\u3096\u30A1-\u30F6]/.test(cellValue);
              const isNotDocument = !cellValue.includes('契約') && !cellValue.includes('様式') &&
                !cellValue.includes('雇用') && !cellValue.includes('合意') &&
                !cellValue.includes('VLOOKUP') && !cellValue.includes('#REF') &&
                !cellValue.includes('株式会社') && !cellValue.includes('有限会社') &&
                !cellValue.includes('合同会社') && !cellValue.includes('を甲') &&
                !cellValue.includes('ＴＹビルテック');

              if ((hasKanji || hasKana) && isNotDocument && cellValue !== 'N/A' && cellValue !== 'FALSE') {
                candidates.push({
                  value: cellValue,
                  score: (hasKanji ? 10 : 0) + cellValue.length
                });
              }
            }
          } catch (err) { }
        }

        // スコアが最も高い候補を選択
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.score - a.score);
          employeeName = candidates[0].value;
        }

        // シート名からカッコ内の名前を抽出
        let sheetNameExtracted = null;
        const parenthesesMatch = sheetName.match(/\(([^)]+)\)$/);
        if (parenthesesMatch && parenthesesMatch[1]) {
          sheetNameExtracted = parenthesesMatch[1].trim();
        }

        // シート名そのものが名前の場合（フォールバック）
        if (!employeeName && !sheetNameExtracted && !/^Sheet\d+$/i.test(sheetName)) {
          employeeName = sheetName;
        }

        sheets.push({
          name: sheetName,
          index: i,
          employeeName: employeeName || sheetNameExtracted || sheetName,
          sheetNameExtracted: sheetNameExtracted,
          rowCount: worksheet.rowCount,
          colCount: worksheet.columnCount
        });

        console.log(`  📋 確定された従業員名: "${employeeName || sheetName}"\n`);
      }

      console.log(`✅ ${sheets.length} 個のシートを抽出しました`);
      return sheets;
    } catch (error) {
      console.error('❌ Excel ファイル解析失敗:', error);
      throw new Error(`Excel ファイル解析失敗: ${error.message}`);
    }
  }


  // シートの内容をHTMLとして取得（ExcelJSでスタイル完全再現版 + 印影画像対応 + 署名合成対応）
  async getSheetHtml(filePath, sheetName, signatureData = null) {
    try {
      const workbook = await this._getWorkbook(filePath);

      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        throw new Error(`シート ${sheetName} が見つかりません`);
      }

      // 1. 各行・列のサイズ情報を収集（座標計算用）
      const maxCol = worksheet.columnCount || 20;
      const maxRow = worksheet.rowCount || 0;

      const colWidths = [];
      let currentLeft = 0;
      const colOffsets = [0]; // 各列の開始位置(px)

      for (let c = 1; c <= maxCol; c++) {
        const col = worksheet.getColumn(c);
        // Excel列幅 (1文字 ≒ 7.5px + パディング)
        const w = col.width ? Math.round(col.width * 7.5 + 5) : 64;
        colWidths[c] = w;
        currentLeft += w;
        colOffsets[c] = currentLeft;
      }

      const rowHeights = [];
      let currentTop = 0;
      const rowOffsets = [0]; // 各行の開始位置(px)

      for (let r = 1; r <= maxRow; r++) {
        const row = worksheet.getRow(r);
        const h = row.height ? Math.round(row.height * 1.33) : 20;
        rowHeights[r] = h;
        currentTop += h;
        rowOffsets[r] = currentTop;
      }

      // 2. 結合セル情報を取得
      const mergedCells = {};
      const skipCells = new Set();
      if (worksheet.model && worksheet.model.merges) {
        for (const merge of worksheet.model.merges) {
          const parts = merge.split(':');
          if (parts.length === 2) {
            const topLeft = this._parseCellRef(parts[0]);
            const bottomRight = this._parseCellRef(parts[1]);
            const rowSpan = bottomRight.row - topLeft.row + 1;
            const colSpan = bottomRight.col - topLeft.col + 1;
            mergedCells[`${topLeft.row}_${topLeft.col}`] = { rowSpan, colSpan };
            for (let r = topLeft.row; r <= bottomRight.row; r++) {
              for (let c = topLeft.col; c <= bottomRight.col; c++) {
                if (r !== topLeft.row || c !== topLeft.col) skipCells.add(`${r}_${c}`);
              }
            }
          }
        }
      }

      // 3. 画像（印影など）を抽出してHTMLタグ化
      let imagesHtml = '';
      const images = worksheet.getImages();
      for (const imgRef of images) {
        try {
          const img = workbook.getImage(imgRef.imageId);
          const range = imgRef.range;
          if (!range || !range.from) continue;

          // 座標計算 (ExcelJSの range.from.col/row は0始まり)
          // ヘッダーのオフセット (HEADER_COL_WIDTH, HEADER_ROW_HEIGHT) を考慮
          const emuToPx = 1 / 9525;
          const left = colOffsets[range.from.col] + (range.from.colOff * emuToPx);
          const top = rowOffsets[range.from.row] + (range.from.rowOff * emuToPx);

          let width, height;
          if (range.to) {
            const right = colOffsets[range.to.col] + (range.to.colOff * emuToPx);
            const bottom = rowOffsets[range.to.row] + (range.to.rowOff * emuToPx);
            width = Math.max(right - left, 10);
            height = Math.max(bottom - top, 10);
          } else {
            width = 100; height = 100;
          }

          const base64 = img.buffer.toString('base64');
          const mimeType = img.extension === 'png' ? 'image/png' : 'image/jpeg';

          imagesHtml += `<img src="data:${mimeType};base64,${base64}" style="position: absolute; left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; pointer-events: none; z-index: 1002; opacity: 1.0; transform-origin: top left;">`;
        } catch (err) {
          console.warn('⚠️ 画像抽出スキップ:', err.message);
        }
      }

      // 4. 署名画像の位置を計算（テーブル生成前に最終コンテンツ行を特定）
      let signatureHtml = '';
      if (signatureData) {
        // 最後のコンテンツ行（テキストがある行）を見つける
        let lastContentRow = 0;
        for (let r = maxRow; r >= 1; r--) {
          const row = worksheet.getRow(r);
          let hasContent = false;
          for (let c = 1; c <= maxCol; c++) {
            const cell = row.getCell(c);
            const val = this._getCellValue(cell);
            if (val && val.trim() !== '') {
              hasContent = true;
              break;
            }
          }
          if (hasContent) {
            lastContentRow = r;
            break;
          }
        }

        if (lastContentRow > 0) {
          // 最終コンテンツ行の下端のpx座標を計算
          let sigTop = 0;
          for (let r = 1; r <= lastContentRow; r++) {
            sigTop += (rowHeights[r] || 20);
          }
          sigTop -= 60; // 行の下端から少し上に配置

          // テーブル全体幅の右端から署名幅分だけ左にオフセット
          const sigWidth = 150;
          const sigLeft = colWidths.reduce((sum, w) => sum + (w || 0), 0) - sigWidth - 20;

          signatureHtml = `<img src="${signatureData}" style="position: absolute; left: ${sigLeft}px; top: ${sigTop}px; width: ${sigWidth}px; height: auto; max-height: 70px; object-fit: contain; pointer-events: none; z-index: 1003; opacity: 0.95;">`;
          console.log(`📍 署名画像を埋め込み: top=${sigTop}px, left=${sigLeft}px (最終行=${lastContentRow})`);
        }
      }

      // 5. HTMLテーブル生成（ヘッダーなし・契約書表示用）
      // テーブル全体幅を計算
      const totalWidth = colWidths.reduce((sum, w) => sum + (w || 0), 0);
      let tableHtml = `<div class="excel-preview-container" style="position: relative; background: white; padding: 0; min-width: ${totalWidth}px;">`;

      tableHtml += `<table id="contract-table" style="border-collapse: collapse; font-family: 'Yu Gothic', '游ゴシック', 'MS Pゴシック', 'Hiragino Kaku Gothic ProN', sans-serif; font-size: 10pt; table-layout: fixed; width: ${totalWidth}px; position: relative; z-index: 1001; background: white; color: #000;">`;

      // colgroup（ヘッダー列なし）
      tableHtml += '<colgroup>';
      for (let c = 1; c <= maxCol; c++) {
        tableHtml += `<col style="width: ${colWidths[c]}px;">`;
      }
      tableHtml += '</colgroup>';

      // 各行（ヘッダー行・行番号なし）
      for (let rowNum = 1; rowNum <= maxRow; rowNum++) {
        const row = worksheet.getRow(rowNum);
        tableHtml += `<tr style="height: ${rowHeights[rowNum]}px;">`;

        for (let colNum = 1; colNum <= maxCol; colNum++) {
          const cellKey = `${rowNum}_${colNum}`;
          if (skipCells.has(cellKey)) continue;

          const cell = row.getCell(colNum);
          const mergeInfo = mergedCells[cellKey];
          const styles = this._getCellStyles(cell);
          const value = this._getCellValue(cell);

          let attrs = `style="${styles}"`;
          if (mergeInfo) {
            if (mergeInfo.rowSpan > 1) attrs += ` rowspan="${mergeInfo.rowSpan}"`;
            if (mergeInfo.colSpan > 1) attrs += ` colspan="${mergeInfo.colSpan}"`;
          }

          tableHtml += `<td ${attrs}>${this._escapeHtml(value)}</td>`;
        }
        tableHtml += '</tr>';
      }

      tableHtml += '</table>';
      
      // html2canvasで確実に上に描画させるため、テーブルの後ろに画像を配置する
      tableHtml += imagesHtml;
      tableHtml += signatureHtml;

      tableHtml += '</div>';

      return {
        sheetName,
        html: tableHtml
      };
    } catch (error) {
      console.error('❌ シートHTML取得失敗:', error);
      throw error;
    }
  }

  // セルのスタイルをインラインCSS文字列に変換
  _getCellStyles(cell) {
    const styles = [];

    // パディングとデフォルト
    styles.push('padding: 2px 4px');
    styles.push('white-space: nowrap');
    styles.push('vertical-align: middle');
    styles.push('border: 0.5px solid #e0e0e0'); // デフォルトのグリッド線

    if (!cell || !cell.style) return styles.join('; ');

    const style = cell.style;

    // フォント
    if (style.font) {
      const font = style.font;
      if (font.name) styles.push(`font-family: '${font.name}', sans-serif`);
      if (font.size) styles.push(`font-size: ${font.size}pt`);
      if (font.bold) styles.push('font-weight: bold');
      if (font.italic) styles.push('font-style: italic');
      if (font.underline) styles.push('text-decoration: underline');
      if (font.strike) styles.push('text-decoration: line-through');
      if (font.color) {
        const color = this._resolveColor(font.color);
        if (color) styles.push(`color: ${color}`);
      }
    }

    // 背景色/塗りつぶし
    if (style.fill) {
      const fill = style.fill;
      if (fill.type === 'pattern' && fill.pattern === 'solid') {
        const bgColor = this._resolveColor(fill.fgColor);
        if (bgColor && bgColor !== '#FFFFFF' && bgColor !== '#ffffff') {
          styles.push(`background-color: ${bgColor}`);
        }
      }
    }

    // 罫線
    if (style.border) {
      const border = style.border;
      if (border.top) styles.push(`border-top: ${this._getBorderCss(border.top)}`);
      if (border.bottom) styles.push(`border-bottom: ${this._getBorderCss(border.bottom)}`);
      if (border.left) styles.push(`border-left: ${this._getBorderCss(border.left)}`);
      if (border.right) styles.push(`border-right: ${this._getBorderCss(border.right)}`);
    }

    // テキスト配置
    if (style.alignment) {
      const align = style.alignment;
      if (align.horizontal) {
        const hMap = { left: 'left', center: 'center', right: 'right', justify: 'justify', fill: 'left' };
        if (hMap[align.horizontal]) styles.push(`text-align: ${hMap[align.horizontal]}`);
      }
      if (align.vertical) {
        const vMap = { top: 'top', middle: 'middle', bottom: 'bottom' };
        if (vMap[align.vertical]) styles.push(`vertical-align: ${vMap[align.vertical]}`);
      }
      if (align.wrapText) {
        // wrapText が有効なら折り返しを許可
        styles.push('white-space: pre-wrap');
        styles.push('word-wrap: break-word');
      }
    }

    return styles.join('; ');
  }

  // セルの値を取得（計算式・リッチテキスト対応）
  _getCellValue(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return '';

    const val = cell.value;

    if (typeof val === 'object') {
      // 計算式の結果
      if (val.result !== undefined) {
        return this._formatValue(val.result, cell.numFmt);
      }
      // リッチテキスト
      if (val.richText) {
        return val.richText.map(rt => rt.text || '').join('');
      }
      // ハイパーリンク
      if (val.text !== undefined) {
        return val.text;
      }
      // Date型
      if (val instanceof Date) {
        return this._formatDate(val);
      }
      return '';
    }

    return this._formatValue(val, cell.numFmt);
  }

  // 値のフォーマット
  _formatValue(val, numFmt) {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) return this._formatDate(val);
    if (typeof val === 'number') {
      // 数値フォーマットがある場合
      if (numFmt) {
        // 日付フォーマットの検出（yyyy, yy, m/d, ge 等）
        const isDateFmt = /[yYgGe]/.test(numFmt) && /[mMdD]/.test(numFmt);
        if (isDateFmt && val > 0 && val < 73050) {
          // Excelの日付シリアル値を日付に変換
          return this._formatDate(this._excelSerialToDate(val));
        }
        // パーセント
        if (numFmt.includes('%')) {
          return (val * 100).toFixed(numFmt.includes('.0') ? 1 : 0) + '%';
        }
        // 通貨・カンマ区切り
        if (numFmt.includes('#,##0') || numFmt.includes(',')) {
          const decimals = (numFmt.match(/0\.(0+)/) || [])[1];
          const fixed = decimals ? val.toFixed(decimals.length) : Math.round(val).toString();
          const parts = fixed.split('.');
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          let result = parts.join('.');
          if (numFmt.includes('¥') || numFmt.includes('￥')) result = '¥' + result;
          if (numFmt.includes('$')) result = '$' + result;
          if (numFmt.includes('円')) result = result + '円';
          return result;
        }
      }
      // numFmtが無くても、数式結果が日付シリアル値の範囲にある場合にフォールバック検出
      // 典型的な日付シリアル値: 36526 (2000/01/01) ～ 54789 (2050/01/01)
      if (Number.isInteger(val) && val >= 36526 && val <= 54789 && (!numFmt || numFmt === 'General')) {
        return this._formatDate(this._excelSerialToDate(val));
      }
      // 小数点以下が長すぎる場合は丸める
      if (!Number.isInteger(val) && String(val).length > 10) {
        return val.toFixed(2);
      }
    }
    return String(val);
  }

  // Excelの日付シリアル値をJavaScript Dateに変換
  _excelSerialToDate(serial) {
    // Excel日付起点: 1899年12月30日（Excelの1900年うるう年バグを考慮）
    const epoch = new Date(1899, 11, 30);
    const msPerDay = 24 * 60 * 60 * 1000;
    return new Date(epoch.getTime() + serial * msPerDay);
  }

  // 日付フォーマット
  _formatDate(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `${y}年${m}月${d}日`;
  }

  // ExcelJS の色情報をCSS色に変換
  _resolveColor(colorObj) {
    if (!colorObj) return null;
    if (colorObj.argb) {
      // ARGB(8桁) → #RRGGBB
      const hex = colorObj.argb.length === 8 ? colorObj.argb.substring(2) : colorObj.argb;
      return `#${hex}`;
    }
    if (colorObj.theme !== undefined) {
      // テーマカラーのおおよそのマッピング
      const themeColors = [
        '#FFFFFF', '#000000', '#44546A', '#4472C4',
        '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5',
        '#70AD47', '#264478', '#9B57A0', '#636363'
      ];
      return themeColors[colorObj.theme] || '#000000';
    }
    return null;
  }

  // 罫線スタイルをCSS形式に変換
  _getBorderCss(border) {
    if (!border || !border.style) return 'none';
    const styleMap = {
      thin: '1px solid',
      medium: '2px solid',
      thick: '3px solid',
      dotted: '1px dotted',
      dashed: '1px dashed',
      double: '3px double',
      hair: '0.5px solid',
      mediumDashed: '2px dashed',
      dashDot: '1px dashed',
      mediumDashDot: '2px dashed',
      dashDotDot: '1px dotted',
      mediumDashDotDot: '2px dotted',
      slantDashDot: '1px dashed'
    };
    const cssStyle = styleMap[border.style] || '1px solid';
    const color = this._resolveColor(border.color) || '#000000';
    return `${cssStyle} ${color}`;
  }

  // セル参照（例: "A1"）を {row, col} に変換
  _parseCellRef(ref) {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) return { row: 1, col: 1 };
    const colStr = match[1];
    const row = parseInt(match[2], 10);
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    return { row, col };
  }

  // 列インデックスを文字（A, B, C... AA, AB...）に変換
  _getColLetter(colIndex) {
    let letter = '';
    while (colIndex > 0) {
      const temp = (colIndex - 1) % 26;
      letter = String.fromCharCode(65 + temp) + letter;
      colIndex = (colIndex - temp - 1) / 26;
    }
    return letter;
  }

  // HTML特殊文字のエスケープ
  _escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // シートデータの詳細取得（値のみ、空セル保持）- 管理者用等の互換性のため維持
  async getSheetData(filePath, sheetIndex) {
    try {
      const workbook = await this._getWorkbook(filePath);

      const worksheet = workbook.worksheets[sheetIndex];
      if (!worksheet) {
        throw new Error(`シート ${sheetIndex} が見つかりません`);
      }

      const data = [];
      let maxCols = 0;

      // 各行の列数を揃えるために最大列数を把握
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        if (row.cellCount > maxCols) {
          maxCols = row.cellCount;
        }
      });

      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const rowData = [];
        // 1列目から maxCols まで確実にループして、空セルによるズレを防ぐ
        for (let colNumber = 1; colNumber <= maxCols; colNumber++) {
          const cell = row.getCell(colNumber);
          let cellValue = '';

          if (cell && cell.value !== null && cell.value !== undefined) {
            const val = cell.value;
            // 計算式の場合
            if (typeof val === 'object') {
              if (val.result !== undefined) {
                cellValue = val.result;
              } else if (val.richText) {
                cellValue = val.richText.map(rt => rt.text).join('');
              } else if (val.text !== undefined) {
                cellValue = val.text;
              } else {
                cellValue = ''; // 解釈不能なオブジェクトは空文字に
              }
            } else {
              cellValue = val;
            }
          }
          rowData.push(cellValue);
        }
        data.push(rowData);
      });

      // 末尾の完全に空な行を削除（見た目をスッキリさせるため）
      while (data.length > 0) {
        const lastRow = data[data.length - 1];
        if (lastRow.every(cell => cell === '' || cell === null)) {
          data.pop();
        } else {
          break;
        }
      }

      return {
        sheetName: worksheet.name,
        sheetIndex,
        data
      };
    } catch (error) {
      console.error('❌ シートデータ取得失敗:', error);
      throw error;
    }
  }

  // 指定したシートのみを含むExcelファイルのバッファ（バイナリデータ）を生成する
  async getSingleSheetExcelBuffer(filePath, targetSheetName) {
    try {
      const workbook = await this._getWorkbook(filePath);

      // 残すシート以外を削除するためのIDリストを作成
      const sheetIdsToRemove = [];
      let foundTarget = false;

      workbook.eachSheet((worksheet, sheetId) => {
        if (worksheet.name === targetSheetName) {
          foundTarget = true;
        } else {
          sheetIdsToRemove.push(sheetId);
        }
      });

      if (!foundTarget) {
        throw new Error(`指定されたシート「${targetSheetName}」が見つかりません`);
      }

      // 対象以外のシートを削除する前に、対象シートの数式を値として固定する（他シート参照エラー防止）
      const targetSheet = workbook.getWorksheet(targetSheetName);
      targetSheet.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (cell && cell.value && typeof cell.value === 'object' && cell.value.formula) {
            // 数式の結果（result）があればそれを値としてセット
            if (cell.value.result !== undefined) {
              const result = cell.value.result;
              const format = cell.numFmt;
              cell.value = result;
              if (format) cell.numFmt = format; // 書式を維持
            }
          }
        });
      });

      // 対象以外のシートを削除
      for (const sheetId of sheetIdsToRemove) {
        workbook.removeWorksheet(sheetId);
      }

      // バッファとして書き出す
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      console.error('❌ 単独シート抽出失敗:', error);
      throw error;
    }
  }
  // 拡張子に応じてWorkbookを読み込む内部メソッド
  async _getWorkbook(filePath) {
    const workbook = new ExcelJS.Workbook();

    if (filePath.toLowerCase().endsWith('.xls')) {
      // .xls (旧形式) の場合は xlsx ライブラリで読み込んで変換
      const xlsWorkbook = XLSX.readFile(filePath);
      const buffer = XLSX.write(xlsWorkbook, { type: 'buffer', bookType: 'xlsx' });
      await workbook.xlsx.load(buffer);
    } else {
      // .xlsx / .xlsm の場合は直接読み込み
      await workbook.xlsx.readFile(filePath);
    }

    return workbook;
  }
}

export default new ExcelService();
