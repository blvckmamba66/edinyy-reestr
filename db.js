import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'data.db');

export const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name    TEXT    NOT NULL,
    last_name     TEXT    NOT NULL,
    gender        TEXT    NOT NULL,
    birth_place   TEXT    NOT NULL,
    citizenship   TEXT    NOT NULL,
    address       TEXT    NOT NULL DEFAULT '',
    specialty     TEXT    NOT NULL DEFAULT '',
    phone         TEXT    NOT NULL UNIQUE,
    consent       INTEGER NOT NULL DEFAULT 0,
    admin_comment TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
  );

  -- Произвольные дополнительные поля, которые добавляет администратор
  CREATE TABLE IF NOT EXISTS user_fields (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    field_name  TEXT    NOT NULL,
    field_value TEXT    NOT NULL DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Одноразовые коды подтверждения телефона
  CREATE TABLE IF NOT EXISTS otp_codes (
    phone       TEXT    PRIMARY KEY,
    code        TEXT    NOT NULL,
    expires_at  INTEGER NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    verified    INTEGER NOT NULL DEFAULT 0
  );
`);

// --- Безопасная миграция для уже существующих баз (добавляем новые колонки) ---
const cols = db.prepare(`PRAGMA table_info(users)`).all();
if (!cols.some((c) => c.name === 'address')) {
  db.exec(`ALTER TABLE users ADD COLUMN address TEXT NOT NULL DEFAULT ''`);
}
if (!cols.some((c) => c.name === 'specialty')) {
  db.exec(`ALTER TABLE users ADD COLUMN specialty TEXT NOT NULL DEFAULT ''`);
}

export default db;
