const { db } = require('./database');
const r = db.prepare("UPDATE spaces SET status = 'available', last_updated = CURRENT_TIMESTAMP WHERE status = 'occupied'").run();
console.log('Reset', r.changes, 'occupied spaces to available');
process.exit(0);
