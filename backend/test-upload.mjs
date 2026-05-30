import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '../電子承認用労働契約書ファイル/電子承認用清掃パート契約書.xlsm');
const fileData = fs.readFileSync(filePath);
const fileName = '電子承認用清掃パート契約書.xlsm';

const boundary = '----FormBoundary' + Date.now();
const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
const footer = `\r\n--${boundary}--\r\n`;

const body = Buffer.concat([Buffer.from(header, 'utf8'), fileData, Buffer.from(footer, 'utf8')]);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/contracts/upload',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      console.log('Response:', JSON.stringify(JSON.parse(data), null, 2));
    } catch {
      console.log('Response (raw):', data);
    }
  });
});

req.on('error', (e) => console.log('Error:', e.message));
req.write(body);
req.end();
