const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // built into Node 22.5+, no native compile needed

const DB_PATH = path.join(__dirname, 'library.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const isNewDb = !fs.existsSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Apply schema (idempotent - uses CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

module.exports = { db, isNewDb };
