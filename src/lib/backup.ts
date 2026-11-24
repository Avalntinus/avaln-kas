/**
 * Format backup JSON. Semua validasi ada di sini (murni, tanpa DB) supaya
 * file yang rusak/diubah tangan tidak pernah masuk ke database.
 *
 * Kategori disimpan sebagai NAMA (bukan id) agar id lokal tidak bentrok
 * saat file dipindah ke HP lain.
 */

import { isISODate } from './date';
import type { ThemeMode } from '../theme/tokens';

export const BACKUP_APP = 'budgeting';
export const BACKUP_VERSION = 1;

export type BackupKind = 'expense' | 'income';

export interface BackupSettings {
  dailyTarget: number;
  weeklyBudget: number;
  weekStart: number;
  debtFloor: number | null;
  themeMode: ThemeMode;
  savingsEnabled: boolean;
  lastSweepPeriod: string | null;
  savingsOffset: number;
  savingsTarget: number;
}

export interface BackupTransaction {
  kind: BackupKind;
  amount: number;
  category: string | null;
  note: string;
  isSavings: boolean;
  localDate: string;
  occurredAt: number;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  settings: BackupSettings;
  categories: string[];
  transactions: BackupTransaction[];
}

const MAX_TRANSACTIONS = 200_000;

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readAmount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${field} harus berupa angka.`);
  }
  const rounded = Math.round(value);
  if (rounded <= 0) fail(`${field} harus lebih besar dari 0.`);
  return rounded;
}

function readText(value: unknown, field: string): string {
  if (typeof value !== 'string') fail(`${field} harus berupa teks.`);
  return value.trim();
}

export function parseBackup(input: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    fail('File bukan JSON yang valid.');
  }

  if (!isRecord(raw)) fail('Isi file tidak dikenali.');
  if (raw.app !== BACKUP_APP) fail('File ini bukan backup aplikasi Budgeting.');
  if (raw.version !== BACKUP_VERSION) {
    fail(`Versi backup ${String(raw.version)} tidak didukung (harus ${BACKUP_VERSION}).`);
  }

  if (!isRecord(raw.settings)) fail('Bagian settings tidak ada.');
  const settings = raw.settings;
  const weeklyBudget = readAmount(settings.weeklyBudget, 'Budget mingguan');
  const dailyTarget =
    settings.dailyTarget === undefined
      ? weeklyBudget
      : readAmount(settings.dailyTarget, 'Target harian');

  const weekStart = settings.weekStart;
  if (
    typeof weekStart !== 'number' ||
    !Number.isInteger(weekStart) ||
    weekStart < 0 ||
    weekStart > 6
  ) {
    fail('Hari mulai minggu harus 0–6.');
  }

  const themeRaw = settings.themeMode;
  const themeMode: ThemeMode =
    themeRaw === 'light' || themeRaw === 'dark' || themeRaw === 'system' ? themeRaw : 'system';

  const savingsEnabled = settings.savingsEnabled !== false;
  const lastRaw = settings.lastSweepPeriod;
  const lastSweepPeriod =
    typeof lastRaw === 'string' && /^\d{4}-\d{2}$/.test(lastRaw) ? lastRaw : null;

  const readInt = (value: unknown, fallback = 0): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;

  const savingsOffset = readInt(settings.savingsOffset, 0);
  const savingsTarget = Math.max(0, readInt(settings.savingsTarget, 0));

  let debtFloor: number | null = null;
  if (settings.debtFloor !== null && settings.debtFloor !== undefined) {
    if (typeof settings.debtFloor !== 'number' || !Number.isFinite(settings.debtFloor)) {
      fail('Batas bawah harus berupa angka atau null.');
    }
    debtFloor = Math.round(settings.debtFloor);
  }

  if (!Array.isArray(raw.categories)) fail('Daftar kategori tidak ada.');
  const categories: string[] = [];
  for (const item of raw.categories) {
    const name = readText(item, 'Nama kategori');
    if (name !== '' && !categories.includes(name)) categories.push(name);
  }

  if (!Array.isArray(raw.transactions)) fail('Daftar transaksi tidak ada.');
  if (raw.transactions.length > MAX_TRANSACTIONS) fail('Jumlah transaksi di file terlalu banyak.');

  const transactions: BackupTransaction[] = raw.transactions.map((item, index) => {
    const at = `Transaksi #${index + 1}`;
    if (!isRecord(item)) fail(`${at} tidak valid.`);

    const kind = item.kind ?? 'expense';
    if (kind !== 'expense' && kind !== 'income') fail(`${at}: jenis harus expense atau income.`);

    const amount = readAmount(item.amount, `${at}: nominal`);

    const localDate = readText(item.localDate, `${at}: tanggal`);
    if (!isISODate(localDate)) fail(`${at}: tanggal harus format YYYY-MM-DD.`);

    const occurredAt =
      typeof item.occurredAt === 'number' && Number.isFinite(item.occurredAt)
        ? Math.round(item.occurredAt)
        : Date.parse(`${localDate}T12:00:00Z`);

    const note = item.note === undefined ? '' : readText(item.note, `${at}: catatan`);

    let category: string | null = null;
    if (item.category !== null && item.category !== undefined) {
      category = readText(item.category, `${at}: kategori`);
      if (category === '') category = null;
    }

    return {
      kind,
      amount,
      category,
      note,
      isSavings: item.isSavings === true,
      localDate,
      occurredAt,
    };
  });

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    settings: {
      dailyTarget,
      weeklyBudget,
      weekStart,
      debtFloor,
      themeMode,
      savingsEnabled,
      lastSweepPeriod,
      savingsOffset,
      savingsTarget,
    },
    categories,
    transactions,
  };
}
