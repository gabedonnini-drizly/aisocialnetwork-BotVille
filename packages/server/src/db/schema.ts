import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '../../botville.db');

let db: DatabaseSync;

export function getDb(): DatabaseSync {
  if (!db) {
    // In prod, DB_PATH points at a persistent volume (e.g. /data/botville.db).
    // On an empty volume the directory may not exist yet — create it, otherwise
    // DatabaseSync fails with ENOENT (TZ-05, volume risk).
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('PRAGMA foreign_keys=ON');
    runMigrations(db);
  }
  return db;
}

function runMigrations(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at INTEGER NOT NULL,
      demo_messages_used INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS demo_ip_usage (
      ip TEXT NOT NULL,
      date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ip, date)
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      avatar_variant INTEGER NOT NULL DEFAULT 0,
      system_prompt TEXT NOT NULL DEFAULT '',
      provider_type TEXT NOT NULL DEFAULT 'claude',
      model_id TEXT NOT NULL,
      ollama_base_url TEXT,
      custom_base_url TEXT,
      location TEXT NOT NULL DEFAULT 'district',
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, slot_index)
    );

    CREATE TABLE IF NOT EXISTS agent_keys (
      agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
      encrypted_key BLOB,
      iv BLOB,
      updated_at INTEGER NOT NULL
    );

    -- TZ-14: USER-level keys (entered once, reused by new agents).
    -- agent_keys stays — an agent's personal key takes priority, and old
    -- agents are not migrated.
    CREATE TABLE IF NOT EXISTS user_keys (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      encrypted_key BLOB NOT NULL,
      iv BLOB NOT NULL,
      -- only the key tail, for recognition in the UI; no decryption needed for that
      masked_key TEXT NOT NULL,
      base_url TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, provider)
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_agent ON chat_history(agent_id, timestamp);
  `);

  // TZ-02, part 1: in older DBs email/password_hash were NOT NULL — anonymous
  // users don't need them. SQLite can't drop NOT NULL, hence the table rebuild.
  const emailNotNull = db
    .prepare(`SELECT "notnull" AS nn FROM pragma_table_info('users') WHERE name = 'email'`)
    .get() as { nn: number } | undefined;
  if (emailNotNull && emailNotNull.nn === 1) {
    db.exec(`
      PRAGMA foreign_keys=OFF;
      BEGIN;
      CREATE TABLE users_migrated (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        plan TEXT NOT NULL DEFAULT 'free',
        created_at INTEGER NOT NULL
      );
      INSERT INTO users_migrated (id, email, password_hash, plan, created_at)
        SELECT id, email, password_hash, plan, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_migrated RENAME TO users;
      COMMIT;
      PRAGMA foreign_keys=ON;
    `);
  }

  // TZ-02, part 2: demo message counter in older DBs
  // (after the users rebuild, so the column doesn't get lost)
  const hasDemoCol = db
    .prepare(`SELECT COUNT(*) AS c FROM pragma_table_info('users') WHERE name = 'demo_messages_used'`)
    .get() as { c: number };
  if (hasDemoCol.c === 0) {
    db.exec(`ALTER TABLE users ADD COLUMN demo_messages_used INTEGER NOT NULL DEFAULT 0`);
  }

  // TZ-14: an agent's baseUrl for the 'custom' provider (older DBs lack the column)
  const hasCustomUrl = db
    .prepare(`SELECT COUNT(*) AS c FROM pragma_table_info('agents') WHERE name = 'custom_base_url'`)
    .get() as { c: number };
  if (hasCustomUrl.c === 0) {
    db.exec(`ALTER TABLE agents ADD COLUMN custom_base_url TEXT`);
  }

  // TZ-16: an agent's coarse location (older DBs lack the column)
  const hasLocation = db
    .prepare(`SELECT COUNT(*) AS c FROM pragma_table_info('agents') WHERE name = 'location'`)
    .get() as { c: number };
  if (hasLocation.c === 0) {
    db.exec(`ALTER TABLE agents ADD COLUMN location TEXT NOT NULL DEFAULT 'district'`);
  }
}
