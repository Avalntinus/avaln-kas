import { BACKUP_APP, BACKUP_VERSION, type BackupFile } from '../lib/backup';
import { addDays, todayISO, type ISODate } from '../lib/date';
import { splitDaily } from '../logic/rollover';
import type { ThemeMode } from '../theme/tokens';
import type { SpendMap } from '../logic/rollover';
import { getDb } from './index';

export interface Settings {
  id: number;
  dailyTarget: number;
  weeklyBudget: number;
  weekStart: number;
  debtFloor: number | null;
  currency: string;
  /** false = tampilkan layar atur budget pertama kali */
  onboarded: boolean;
  /** Tanggal lokal saat app mulai dipakai; minggu sebelumnya diabaikan. */
  startedOn: ISODate;
  themeMode: ThemeMode;
  savingsEnabled: boolean;
  /** Periode (YYYY-MM) terakhir yang sudah di-sweep. */
  lastSweepPeriod: string | null;
  /** Koreksi saldo tabungan (tidak memengaruhi jatah mingguan). */
  savingsOffset: number;
  /** Target tabungan; 0 = belum diatur. */
  savingsTarget: number;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  sort: number;
}

export type TransactionKind = 'expense' | 'income';

export interface Transaction {
  id: number;
  kind: TransactionKind;
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  note: string;
  /** true = perpindahan ke/dari tabungan, bukan konsumsi. */
  isSavings: boolean;
  occurredAt: number;
  localDate: ISODate;
  createdAt: number;
}

export interface NewTransaction {
  kind?: TransactionKind;
  amount: number;
  categoryId?: number | null;
  note?: string;
  isSavings?: boolean;
  /** epoch ms; default sekarang */
  occurredAt?: number;
  /** default tanggal lokal dari occurredAt */
  localDate?: ISODate;
}

export interface WeekRow {
  weekStart: ISODate;
  budget: number;
  rolloverIn: number;
  spent: number;
  rolloverOut: number;
  closed: boolean;
}

interface SettingsRow {
  id: number;
  daily_target: number;
  weekly_budget: number;
  week_start: number;
  debt_floor: number | null;
  currency: string;
  onboarded: number;
  started_on: string | null;
  theme_mode: string;
  savings_enabled: number;
  last_sweep_period: string | null;
  savings_offset: number;
  savings_target: number;
}

interface CategoryRow {
  id: number;
  name: string;
  icon: string;
  sort: number;
}

interface TransactionRow {
  id: number;
  kind: TransactionKind;
  amount: number;
  category_id: number | null;
  category_name: string | null;
  note: string;
  is_savings: number;
  occurred_at: number;
  local_date: string;
  created_at: number;
}

interface WeekDbRow {
  week_start: string;
  budget: number;
  rollover_in: number;
  spent: number;
  rollover_out: number;
  closed: number;
}

const SELECT_TX = `
  SELECT t.id, t.kind, t.amount, t.category_id, c.name AS category_name,
         t.note, t.is_savings, t.occurred_at, t.local_date, t.created_at
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id`;

const ORDER_TX = 'ORDER BY t.occurred_at DESC, t.id DESC';

const SETTINGS_COLUMNS = {
  dailyTarget: 'daily_target',
  weeklyBudget: 'weekly_budget',
  weekStart: 'week_start',
  debtFloor: 'debt_floor',
  currency: 'currency',
  onboarded: 'onboarded',
  startedOn: 'started_on',
  themeMode: 'theme_mode',
  savingsEnabled: 'savings_enabled',
  lastSweepPeriod: 'last_sweep_period',
  savingsOffset: 'savings_offset',
  savingsTarget: 'savings_target',
} as const;

type SettingsKey = keyof typeof SETTINGS_COLUMNS;

function mapSettings(row: SettingsRow): Settings {
  return {
    id: row.id,
    dailyTarget: row.daily_target,
    weeklyBudget: row.weekly_budget,
    weekStart: row.week_start,
    debtFloor: row.debt_floor,
    currency: row.currency,
    onboarded: row.onboarded === 1,
    startedOn: row.started_on ?? todayISO(),
    themeMode: row.theme_mode === 'dark' || row.theme_mode === 'light' ? row.theme_mode : 'system',
    savingsEnabled: row.savings_enabled === 1,
    lastSweepPeriod: row.last_sweep_period,
    savingsOffset: row.savings_offset ?? 0,
    savingsTarget: row.savings_target ?? 0,
  };
}

function mapCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, icon: row.icon, sort: row.sort };
}

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    kind: row.kind,
    amount: row.amount,
    categoryId: row.category_id,
    categoryName: row.category_name,
    note: row.note,
    isSavings: row.is_savings === 1,
    occurredAt: row.occurred_at,
    localDate: row.local_date,
    createdAt: row.created_at,
  };
}

function mapWeek(row: WeekDbRow): WeekRow {
  return {
    weekStart: row.week_start,
    budget: row.budget,
    rolloverIn: row.rollover_in,
    spent: row.spent,
    rolloverOut: row.rollover_out,
    closed: row.closed === 1,
  };
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const row = await db.getFirstAsync<SettingsRow>(
    `SELECT id, daily_target, weekly_budget, week_start, debt_floor, currency,
            onboarded, started_on, theme_mode, savings_enabled, last_sweep_period,
            savings_offset, savings_target
       FROM settings WHERE id = 1`,
  );
  if (!row) throw new Error('Settings belum terinisialisasi');
  return mapSettings(row);
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const entries = (Object.keys(patch) as SettingsKey[])
    .filter((key) => patch[key] !== undefined)
    .map((key) => [SETTINGS_COLUMNS[key], patch[key]] as const);

  if (entries.length > 0) {
    const db = await getDb();
    const assignment = entries.map(([column]) => `${column} = ?`).join(', ');
    await db.runAsync(
      `UPDATE settings SET ${assignment} WHERE id = 1`,
      entries.map(([, value]) => (typeof value === 'boolean' ? Number(value) : (value ?? null))),
    );
  }

  if (entries.length > 0) await clearWeeks();

  return getSettings();
}

/** Simpan budget awal dari layar sambutan, lalu tandai onboarding selesai. */
export async function completeOnboarding(input: {
  weeklyBudget: number;
  weekStart: number;
}): Promise<void> {
  const weeklyBudget = Math.max(0, Math.round(input.weeklyBudget));
  const dailyTarget = splitDaily(weeklyBudget).base;

  await updateSettings({
    weeklyBudget,
    dailyTarget,
    weekStart: input.weekStart,
    debtFloor: weeklyBudget > 0 ? -weeklyBudget : null,
    onboarded: true,
    startedOn: todayISO(),
  });
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT id, name, icon, sort FROM categories ORDER BY sort ASC, id ASC',
  );
  return rows.map(mapCategory);
}

export async function addCategory(name: string, icon = 'tag'): Promise<Category> {
  const clean = name.trim();
  if (clean === '') throw new Error('Nama kategori tidak boleh kosong');

  const db = await getDb();
  const sortRow = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sort), 0) + 1 AS next FROM categories',
  );
  const sort = sortRow?.next ?? 1;
  const result = await db.runAsync(
    'INSERT INTO categories (name, icon, sort) VALUES (?, ?, ?)',
    clean,
    icon,
    sort,
  );

  return { id: result.lastInsertRowId, name: clean, icon, sort };
}

/** Hapus kategori. Transaksi lama tetap ada, category_id-nya jadi NULL. */
export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
}

export async function countTransactionsByCategory(categoryId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM transactions WHERE category_id = ?',
    categoryId,
  );
  return row?.total ?? 0;
}

export async function deleteAllTransactions(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM transactions; DELETE FROM weeks;');
}

export async function countCategories(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM categories');
  return row?.total ?? 0;
}

export async function addTransaction(input: NewTransaction): Promise<Transaction> {
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal harus lebih besar dari 0');
  }

  const now = Date.now();
  const occurredAt = input.occurredAt ?? now;
  const localDate = input.localDate ?? todayISO(new Date(occurredAt));
  const note = (input.note ?? '').trim();

  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO transactions
       (kind, amount, category_id, note, is_savings, occurred_at, local_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.kind ?? 'expense',
    amount,
    input.categoryId ?? null,
    note,
    input.isSavings ? 1 : 0,
    occurredAt,
    localDate,
    now,
  );

  const row = await db.getFirstAsync<TransactionRow>(
    `${SELECT_TX} WHERE t.id = ?`,
    result.lastInsertRowId,
  );
  if (!row) throw new Error('Gagal membaca transaksi yang baru disimpan');

  await invalidateWeeksFrom(localDate);
  return mapTransaction(row);
}

export async function updateTransaction(
  id: number,
  patch: Partial<Omit<NewTransaction, 'occurredAt'>> & { occurredAt?: number },
): Promise<void> {
  const columns: string[] = [];
  const values: (string | number | null)[] = [];

  if (patch.kind !== undefined) {
    columns.push('kind = ?');
    values.push(patch.kind);
  }
  if (patch.amount !== undefined) {
    const amount = Math.round(patch.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error('Nominal harus lebih besar dari 0');
    columns.push('amount = ?');
    values.push(amount);
  }
  if (patch.categoryId !== undefined) {
    columns.push('category_id = ?');
    values.push(patch.categoryId ?? null);
  }
  if (patch.note !== undefined) {
    columns.push('note = ?');
    values.push(patch.note.trim());
  }
  if (patch.localDate !== undefined) {
    columns.push('local_date = ?');
    values.push(patch.localDate);
  }
  if (patch.occurredAt !== undefined) {
    columns.push('occurred_at = ?');
    values.push(patch.occurredAt);
  }

  if (columns.length === 0) return;

  const db = await getDb();
  values.push(id);
  await db.runAsync(`UPDATE transactions SET ${columns.join(', ')} WHERE id = ?`, values);

  // Tanggal bisa ikut berubah; pakai tanggal lama dan baru untuk invalidasi.
  const dates = new Set<string>();
  const old = await db.getFirstAsync<{ local_date: string }>(
    'SELECT local_date FROM transactions WHERE id = ?',
    id,
  );
  if (old) dates.add(old.local_date);
  if (patch.localDate) dates.add(patch.localDate);

  // patch.localDate sudah tersimpan, jadi baca ulang untuk memastikan.
  const current = await db.getFirstAsync<{ local_date: string }>(
    'SELECT local_date FROM transactions WHERE id = ?',
    id,
  );
  if (current) dates.add(current.local_date);

  for (const date of dates) await invalidateWeeksFrom(date);
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ local_date: string }>(
    'SELECT local_date FROM transactions WHERE id = ?',
    id,
  );
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
  if (row) await invalidateWeeksFrom(row.local_date);
}

export async function listTransactionsByDate(date: ISODate): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionRow>(
    `${SELECT_TX} WHERE t.local_date = ? ${ORDER_TX}`,
    date,
  );
  return rows.map(mapTransaction);
}

export async function getTransaction(id: number): Promise<Transaction | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<TransactionRow>(`${SELECT_TX} WHERE t.id = ?`, id);
  return row ? mapTransaction(row) : null;
}

export async function getEarliestTransactionDate(): Promise<ISODate | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ earliest: string | null }>(
    'SELECT MIN(local_date) AS earliest FROM transactions',
  );
  return row?.earliest ?? null;
}

export async function listTransactionsBetween(from: ISODate, to: ISODate): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionRow>(
    `${SELECT_TX} WHERE t.local_date BETWEEN ? AND ? ORDER BY t.local_date DESC, t.occurred_at DESC`,
    from,
    to,
  );
  return rows.map(mapTransaction);
}

export async function listRecentTransactions(limit = 50): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionRow>(`${SELECT_TX} ${ORDER_TX} LIMIT ?`, limit);
  return rows.map(mapTransaction);
}

export async function countTransactions(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM transactions',
  );
  return row?.total ?? 0;
}

/** Total belanja per tanggal dalam rentang (inklusif). */
export async function getSpendByDate(from: ISODate, to: ISODate): Promise<SpendMap> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ local_date: string; total: number }>(
    `SELECT local_date, SUM(amount) AS total
       FROM transactions
      WHERE kind = 'expense' AND local_date BETWEEN ? AND ?
      GROUP BY local_date`,
    from,
    to,
  );

  const map: SpendMap = {};
  for (const row of rows) map[row.local_date] = row.total;
  return map;
}

/** Saldo tabungan = pemasukan bertanda tabungan − pengeluaran bertanda tabungan. */
export async function getSavingsBalance(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT
        (SELECT COALESCE(s.savings_offset, 0) FROM settings s WHERE s.id = 1)
        + (SELECT COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount ELSE -amount END), 0)
             FROM transactions WHERE is_savings = 1) AS total`,
  );
  return row?.total ?? 0;
}

export async function listSavingsMoves(limit = 100): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionRow>(
    `${SELECT_TX} WHERE t.is_savings = 1 ${ORDER_TX} LIMIT ?`,
    limit,
  );
  return rows.map(mapTransaction);
}

/**
 * Catat sweep tabungan dalam satu transaksi DB: pengeluaran bertanda tabungan
 * (mengurangi sisa) + penanda periode. Idempoten lewat `last_sweep_period`.
 */
export async function applySavingsSweep(input: {
  period: string;
  amount: number;
  date: ISODate;
}): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    if (input.amount > 0) {
      await db.runAsync(
        `INSERT INTO transactions
           (kind, amount, category_id, note, is_savings, occurred_at, local_date, created_at)
         VALUES ('expense', ?, NULL, ?, 1, ?, ?, ?)`,
        Math.round(input.amount),
        'Sweep tabungan',
        new Date(`${input.date}T12:00:00`).getTime(),
        input.date,
        now,
      );
    }

    await db.runAsync('UPDATE settings SET last_sweep_period = ? WHERE id = 1', input.period);
    await db.runAsync('DELETE FROM weeks WHERE week_start >= ?', addDays(input.date, -6));
  });
}

/** Tandai periode (YYYY-MM) sudah di-sweep, supaya tidak berulang. */
export async function markSweepPeriod(period: string): Promise<void> {
  await updateSettings({ lastSweepPeriod: period });
}

/** Total pemasukan dalam rentang tanggal (inklusif). */
export async function getIncomeBetween(from: ISODate, to: ISODate): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount) AS total
       FROM transactions
      WHERE kind = 'income' AND local_date BETWEEN ? AND ?`,
    from,
    to,
  );
  return row?.total ?? 0;
}

/**
 * Buang cache minggu mulai dari minggu yang memuat `date` ke depan.
 * Dipakai setiap kali transaksi berubah supaya rollover dihitung ulang.
 */
export async function invalidateWeeksFrom(date: ISODate): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM weeks WHERE week_start >= ?', addDays(date, -6));
}

export async function exportBackup(): Promise<BackupFile> {
  const [settings, categories, transactions] = await Promise.all([
    getSettings(),
    listCategories(),
    listRecentTransactions(200_000),
  ]);

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      dailyTarget: settings.dailyTarget,
      weeklyBudget: settings.weeklyBudget,
      weekStart: settings.weekStart,
      debtFloor: settings.debtFloor,
      themeMode: settings.themeMode,
      savingsEnabled: settings.savingsEnabled,
      lastSweepPeriod: settings.lastSweepPeriod,
      savingsOffset: settings.savingsOffset,
      savingsTarget: settings.savingsTarget,
    },
    categories: categories.map((category) => category.name),
    transactions: transactions.map((tx) => ({
      kind: tx.kind,
      amount: tx.amount,
      category: tx.categoryName,
      note: tx.note,
      isSavings: tx.isSavings,
      localDate: tx.localDate,
      occurredAt: tx.occurredAt,
    })),
  };
}

/**
 * Ganti seluruh isi database dengan isi backup.
 * Dipanggil hanya setelah `parseBackup` lolos validasi.
 */
export async function importBackup(backup: BackupFile): Promise<{ transactions: number }> {
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM transactions; DELETE FROM weeks;');

    const names = new Set<string>(backup.categories);
    for (const tx of backup.transactions) {
      if (tx.category) names.add(tx.category);
    }
    for (const name of names) {
      await db.runAsync(
        'INSERT OR IGNORE INTO categories (name, icon, sort) VALUES (?, ?, ?)',
        name,
        'tag',
        100,
      );
    }

    const rows = await db.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM categories',
    );
    const idByName = new Map(rows.map((row) => [row.name, row.id]));
    const createdAt = Date.now();

    for (const tx of backup.transactions) {
      const categoryId = tx.category ? (idByName.get(tx.category) ?? null) : null;
      await db.runAsync(
        `INSERT INTO transactions
           (kind, amount, category_id, note, is_savings, occurred_at, local_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        tx.kind,
        tx.amount,
        categoryId,
        tx.note,
        tx.isSavings ? 1 : 0,
        tx.occurredAt,
        tx.localDate,
        createdAt,
      );
    }

    await db.runAsync(
      `UPDATE settings
          SET daily_target = ?, weekly_budget = ?, week_start = ?, debt_floor = ?,
              theme_mode = ?, savings_enabled = ?, last_sweep_period = ?,
              savings_offset = ?, savings_target = ?
        WHERE id = 1`,
      backup.settings.dailyTarget,
      backup.settings.weeklyBudget,
      backup.settings.weekStart,
      backup.settings.debtFloor,
      backup.settings.themeMode,
      backup.settings.savingsEnabled ? 1 : 0,
      backup.settings.lastSweepPeriod,
      backup.settings.savingsOffset,
      backup.settings.savingsTarget,
    );
  });

  return { transactions: backup.transactions.length };
}

/** Hapus semua cache minggu (dipakai saat Settings berubah). */
export async function clearWeeks(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM weeks');
}

export async function getWeekRow(weekStart: ISODate): Promise<WeekRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<WeekDbRow>(
    'SELECT week_start, budget, rollover_in, spent, rollover_out, closed FROM weeks WHERE week_start = ?',
    weekStart,
  );
  return row ? mapWeek(row) : null;
}

export async function upsertWeekRow(row: WeekRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO weeks (week_start, budget, rollover_in, spent, rollover_out, closed)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(week_start) DO UPDATE SET
       budget = excluded.budget,
       rollover_in = excluded.rollover_in,
       spent = excluded.spent,
       rollover_out = excluded.rollover_out,
       closed = excluded.closed`,
    row.weekStart,
    row.budget,
    row.rolloverIn,
    row.spent,
    row.rolloverOut,
    row.closed ? 1 : 0,
  );
}

/**
 * Rollover masuk untuk sebuah minggu: pakai baris minggu itu kalau ada,
 * kalau belum ada pakai rollover_out minggu sebelumnya (0 kalau tidak ada).
 */
export async function resolveRolloverIn(weekStart: ISODate): Promise<number> {
  const current = await getWeekRow(weekStart);
  if (current) return current.rolloverIn;

  const previous = await getWeekRow(addDays(weekStart, -7));
  return previous?.rolloverOut ?? 0;
}
