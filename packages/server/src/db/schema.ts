import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '../../botville.db');

let db: DatabaseSync;

export function getDb(): DatabaseSync {
  if (!db) {
    // На проде DB_PATH указывает на persistent-volume (напр. /data/botville.db).
    // На пустом volume каталога может ещё не быть — создаём, иначе DatabaseSync
    // упадёт с ENOENT (ТЗ-05, риск volume).
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

    -- ТЗ-14: ключи на уровне ЮЗЕРА (вводятся один раз, переиспользуются
    -- новыми агентами). agent_keys остаётся — личный ключ агента имеет
    -- приоритет, старые агенты не мигрируем.
    CREATE TABLE IF NOT EXISTS user_keys (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      encrypted_key BLOB NOT NULL,
      iv BLOB NOT NULL,
      -- только хвост ключа для узнавания в UI; расшифровка для этого не нужна
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

  // ТЗ-02, часть 1: в старых БД email/password_hash были NOT NULL — анонимам
  // они не нужны. SQLite не умеет снимать NOT NULL, поэтому пересборка таблицы.
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

  // ТЗ-02, часть 2: счётчик demo-сообщений в старых БД
  // (после пересборки users, чтобы колонка не потерялась)
  const hasDemoCol = db
    .prepare(`SELECT COUNT(*) AS c FROM pragma_table_info('users') WHERE name = 'demo_messages_used'`)
    .get() as { c: number };
  if (hasDemoCol.c === 0) {
    db.exec(`ALTER TABLE users ADD COLUMN demo_messages_used INTEGER NOT NULL DEFAULT 0`);
  }

  // ТЗ-14: baseUrl провайдера 'custom' у агента (в старых БД колонки нет)
  const hasCustomUrl = db
    .prepare(`SELECT COUNT(*) AS c FROM pragma_table_info('agents') WHERE name = 'custom_base_url'`)
    .get() as { c: number };
  if (hasCustomUrl.c === 0) {
    db.exec(`ALTER TABLE agents ADD COLUMN custom_base_url TEXT`);
  }

  // ТЗ-16: грубое местоположение агента (в старых БД колонки нет)
  const hasLocation = db
    .prepare(`SELECT COUNT(*) AS c FROM pragma_table_info('agents') WHERE name = 'location'`)
    .get() as { c: number };
  if (hasLocation.c === 0) {
    db.exec(`ALTER TABLE agents ADD COLUMN location TEXT NOT NULL DEFAULT 'district'`);
  }
}
