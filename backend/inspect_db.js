import sqlite3 from 'sqlite3';

const dbPath = 'data/contract_approval.db';
const db = new sqlite3.Database(dbPath);

console.log('--- Checking Recent Contracts (all) ---');
db.all('SELECT * FROM contracts ORDER BY uploaded_at DESC LIMIT 5', [], (err, rows) => {
    if (err) console.error(err);
    console.table(rows);

    if (rows && rows.length > 0) {
        const latestId = rows[0].id;
        console.log(`\n--- Sheets for contract ${latestId} ---`);
        db.all('SELECT cs.*, u.full_name FROM contract_sheets cs LEFT JOIN users u ON cs.user_id = u.id WHERE cs.contract_id = ?', [latestId], (err, sheets) => {
            if (err) console.error(err);
            console.table(sheets);
            db.close();
        });
    } else {
        db.close();
    }
});
