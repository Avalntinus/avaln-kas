import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'budgeting.db';
export const DATABASE_VERSION = 3;

const MIGRATION_1 = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  daily_target  INTEGER NOT NULL,
  weekly_budget INTEGER NOT NULL,
  week_start    INTEGER NOT NULL DEFAULT 1,
  debt_floor    INTEGER,
  currency      TEXT    NOT NULL DEFAULT 'IDR',
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT    NOT NULL UNIQUE,
  icon  TEXT    NOT NULL,
  sort  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  note        TEXT    NOT NULL DEFAULT '',
  occurred_at INTEGER NOT NULL,
  local_date  TEXT    NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_local_date  ON transactions(local_date);
CREATE INDEX IF NOT EXISTS idx_tx_occurred_at ON transactions(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_category    ON transactions(category_id);

CREATE TABLE IF NOT EXISTS weeks (
  week_start   TEXT    PRIMARY KEY,
  budget       INTEGER NOT NULL,
  rollover_in  INTEGER NOT NULL,
  spent        INTEGER NOT NULL,
  rollover_out INTEGER NOT NULL,
  closed       INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO settings
  (id, daily_target, weekly_budget, week_start, debt_floor, currency, created_at)
VALUES
  (1, 30000, 210000, 1, -210000, 'IDR', strftime('%s', 'now') * 1000);

INSERT OR IGNORE INTO categories (name, icon, sort) VALUES
  ('Makan', 'utensils', 1),
  ('Transport', 'bus', 2),
  ('Jajan', 'coffee', 3),
  ('Lainnya', 'circle-ellipsis', 4);
`;

const MIGRATION_2 = `
ALTER TABLE transactions ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense'
  CHECK (kind IN ('expense', 'income'));

CREATE INDEX IF NOT EXISTS idx_tx_kind ON transactions(kind);
`;

const MIGRATION_3 = `
ALTER TABLE settings ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0;

-- Database lama yang sudah punya transaksi dianggap sudah melewati onboarding.
UPDATE settings
   SET onboarded = CASE WHEN (SELECT COUNT(*) FROM transactions) > 0 THEN 1 ELSE 0 END
 WHERE id = 1;
`;

export const MIGRATIONS: readonly string[] = [MIGRATION_1, MIGRATION_2, MIGRATION_3];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= DATABASE_VERSION) return;

  for (let version = current; version < DATABASE_VERSION; version += 1) {
    await db.execAsync(MIGRATIONS[version]);
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
