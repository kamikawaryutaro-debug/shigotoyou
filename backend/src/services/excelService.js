import ExcelJS from 'exceljs';

class ExcelService {
  // Excelファイルからシート情報を抽出
  async extractSheets(filePath) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const sheets = [];

      for (let i = 0; i < workbook.worksheets.length; i++) {
        const worksheet = workbook.worksheets[i];
        const sheetName = worksheet.name;

        // 複数のセルから従業員名を抽出
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
                !cellValue.includes('VLOOKUP') && !cellValue.includes('#REF');

              if ((hasKanji || hasKana) && isNotDocument && cellValue !== 'N/A' && cellValue !== 'FALSE') {
                candidates.push({
                  value: cellValue,
                  score: (hasKanji ? 10 : 0) + cellValue.length
                });
                console.log(`  📍 候補発見 (${cellRef}): "${cellValue}" (Score: ${(hasKanji ? 10 : 0) + cellValue.length})`);
              }
            }
          } catch (err) { }
        }

        // スコアが最も高い候補を選択
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.score - a.score);
          employeeName = candidates[0].value;
          console.log(`  ✅ 最良の候補を選択: "${employeeName}"`);
        }

        // シート名から括弧内の名前を常に抽出（バックアップ用）
        let sheetNameExtracted = null;
        const parenthesesMatch = sheetName.match(/\(([^)]+)\)$/);
        if (parenthesesMatch && parenthesesMatch[1]) {
          const extracted = parenthesesMatch[1].trim();
          if (extracted.length >= 2 && extracted.length < 20) {
            sheetNameExtracted = extracted;
            console.log(`  📌 シート名から苗字を抽出: "${sheetNameExtracted}"`);
          }
        }

        // セルから見つからない場合、シート名から抽出した名前を使用
        if (!employeeName && sheetNameExtracted) {
          employeeName = sheetNameExtracted;
          console.log(`  ✅ シート名から抽出した苗字を使用: "${employeeName}"`);
        }

        sheets.push({
          name: sheetName,
          index: i,
          employeeName: employeeName || sheetName,
          sheetNameExtracted: sheetNameExtracted, // シート名から抽出した苗字（バックアップ用）
          rowCount: worksheet.rowCount,
          colCount: worksheet.columnCount
        });

        console.log(`  📋 確定された従業員名: "${employeeName || sheetName}"`);
        if (sheetNameExtracted) {
          console.log(`  📋 シート名から抽出: "${sheetNameExtracted}"\n`);
        }
      }

      console.log(`✅ ${sheets.length} 個のシートを抽出しました`);
      return sheets;
    } catch (error) {
      console.error('❌ Excel ファイル解析失敗:', error);
      throw new Error(`Excel ファイル解析失敗: ${error.message}`);
    }
  }


  // シートの内容をHTMLとして取得（見た目・結合・計算式を再現）
  async getSheetHtml(filePath, sheetName) {
    try {
      const imported = await import('xlsx');
      const XLSX = imported.default || imported;
      const workbook = XLSX.readFile(filePath);

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`シート ${sheetName} が見つかりません`);
      }

      // エクセルのシートをHTMLの<table>タグに変換（結合なども維持される）
      const html = XLSX.utils.sheet_to_html(worksheet, { id: 'contract-table' });

      return {
        sheetName,
        html
      };
    } catch (error) {
      console.error('❌ シートHTML取得失敗:', error);
      throw error;
    }
  }

  // シートデータの詳細取得（値のみ、空セル保持）- 管理者用等の互換性のため維持
  async getSheetData(filePath, sheetIndex) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

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
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

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
}

export default new ExcelService();
