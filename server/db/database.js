const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbPath = process.env.DB_PATH || path.join(__dirname, 'runeword.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaSQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT UNIQUE NOT NULL,
    class TEXT NOT NULL DEFAULT 'WARRIOR',
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 200,
    max_hp INTEGER DEFAULT 200,
    mp INTEGER DEFAULT 50,
    max_mp INTEGER DEFAULT 50,
    atk INTEGER DEFAULT 15,
    def INTEGER DEFAULT 12,
    speed REAL DEFAULT 3.0,
    gold INTEGER DEFAULT 100,
    zone TEXT DEFAULT 'forest_of_words',
    x REAL DEFAULT 4500,
    y REAL DEFAULT 3600,
    words_correct INTEGER DEFAULT 0,
    words_wrong INTEGER DEFAULT 0,
    monsters_killed INTEGER DEFAULT 0,
    total_exp_earned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    slot INTEGER,
    equipped INTEGER DEFAULT 0,
    enhancement_level INTEGER DEFAULT 0,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS word_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    word_id INTEGER NOT NULL,
    correct INTEGER NOT NULL,
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS chat_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_name TEXT NOT NULL,
    message TEXT NOT NULL,
    channel TEXT DEFAULT 'all',
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_character ON inventory(character_id);
  CREATE INDEX IF NOT EXISTS idx_word_history_character ON word_history(character_id);
`;
db.exec(schemaSQL);

// Migration: add enhancement_level column if missing (for existing DBs)
try {
  db.prepare("SELECT enhancement_level FROM inventory LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE inventory ADD COLUMN enhancement_level INTEGER DEFAULT 0");
  console.log("Migration: added enhancement_level column to inventory");
}

module.exports = db;
