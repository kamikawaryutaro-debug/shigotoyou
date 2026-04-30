import excelService from './src/services/excelService.js';
import path from 'path';

const filePath = 'uploads/労働契約書_アーカイブ-1776580027876.xlsx';

async function test() {
    try {
        console.log(`Testing file: ${filePath}`);
        const sheets = await excelService.extractSheets(filePath);
        console.log(JSON.stringify(sheets, null, 2));
    } catch (err) {
        console.error(err);
    }
}

test();
