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
    phone         TEXT    NOT NULL UNIQUE,
    consent       INTEGER NOT NULL DEFAULT 0,
    admin_comment TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
  );
`);

export default db;
