/**
 * Parser "tambah cepat" — murni, tanpa jaringan.
 *
 * Contoh yang dikenali:
 *   "makan siang 25rb"        -> expense 25000, kategori Makan
 *   "gaji 1,5jt"              -> income 1500000
 *   "kemarin bensin 50.000"   -> expense 50000, tanggal kemarin
 *
 * Kalau nominal tidak yakin, kembalikan null supaya UI minta input manual
 * (atau menawarkan AI bila dikonfigurasi).
 */

import { addDays, type ISODate } from '../lib/date';
import { normalizeNote } from '../lib/money';

export type QuickKind = 'expense' | 'income';

export interface QuickCategory {
  id: number;
  name: string;
}

export interface QuickParse {
  kind: QuickKind;
  amount: number;
  note: string;
  categoryName: string | null;
  date: ISODate;
  /** false = nominal hasil tebakan tanpa satuan/pemisah */
  confident: boolean;
}

const INCOME_WORDS = [
  'gaji',
  'bonus',
  'thr',
  'honor',
  'fee',
  'komisi',
  'cashback',
  'refund',
  'jual',
  'terima',
  'dapat',
  'masuk',
  'pemasukan',
  'pendapatan',
];

const CATEGORY_WORDS: Record<string, string[]> = {
  Makan: [
    'makan',
    'makanan',
    'nasi',
    'warteg',
    'warung',
    'bakso',
    'mie',
    'ayam',
    'sate',
    'sarapan',
    'siang',
    'malam',
    'lunch',
    'dinner',
  ],
  Transport: [
    'bensin',
    'pertalite',
    'pertamax',
    'ojek',
    'gojek',
    'grab',
    'gocar',
    'parkir',
    'tol',
    'bus',
    'kereta',
    'krl',
    'mrt',
    'ongkos',
    'transport',
    'taksi',
  ],
  Jajan: [
    'jajan',
    'snack',
    'camilan',
    'kopi',
    'cafe',
    'kafe',
    'boba',
    'es',
    'kue',
    'martabak',
    'dessert',
  ],
};

const AMOUNT_RE = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)?/gi;

function parseAmount(raw: string, unit?: string): number | null {
  const u = (unit ?? '').toLowerCase();
  const multiplier =
    u === 'jt' || u === 'juta' ? 1_000_000 : u === 'rb' || u === 'ribu' || u === 'k' ? 1_000 : 1;

  let normalized = raw;

  if (multiplier > 1) {
    if (raw.includes(',') && raw.includes('.')) {
      // pemisah terakhir dianggap desimal
      if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
        normalized = raw.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = raw.replace(/,/g, '');
      }
    } else if (raw.includes(',')) {
      normalized = raw.replace(',', '.');
    } else if (raw.includes('.')) {
      const [, fraction = ''] = raw.split('.');
      // "1.5jt" desimal, "1.500jt" ribuan
      normalized = fraction.length <= 2 ? raw : raw.replace(/\./g, '');
    }
  } else {
    // tanpa satuan: titik/koma pasti pemisah ribuan
    normalized = raw.replace(/[.,]/g, '');
    const digits = normalized;
    if (digits.length < 3 && Number(digits) < 1000) return null;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;

  const amount = Math.round(value * multiplier);
  if (amount < 500) return null;
  return amount;
}

function findAmount(
  input: string,
): { amount: number; raw: string; unit?: string; index: number } | null {
  AMOUNT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = AMOUNT_RE.exec(input)) !== null) {
    const [full, raw, unit] = match;
    const amount = parseAmount(raw, unit);
    if (amount !== null) {
      return { amount, raw: full, unit, index: match.index };
    }
  }
  return null;
}

function detectKind(input: string): QuickKind {
  const lower = input.toLowerCase();
  return INCOME_WORDS.some((word) => lower.includes(word)) ? 'income' : 'expense';
}

function detectCategory(input: string, categories: readonly QuickCategory[]): string | null {
  const lower = input.toLowerCase();
  const names = new Map(categories.map((c) => [c.name.toLowerCase(), c.name]));

  for (const [categoryName, words] of Object.entries(CATEGORY_WORDS)) {
    if (!names.has(categoryName.toLowerCase())) continue;
    if (words.some((word) => new RegExp(`\\b${word}\\b`).test(lower))) {
      return names.get(categoryName.toLowerCase()) ?? null;
    }
  }
  return null;
}

export function parseQuickAdd(
  input: string,
  ctx: { today: ISODate; categories: readonly QuickCategory[] },
): QuickParse | null {
  const text = input.trim();
  if (text === '') return null;

  const found = findAmount(text);
  if (!found) return null;

  const isYesterday = /\b(kemarin|kmrn|yesterday)\b/i.test(text);
  const date = isYesterday ? addDays(ctx.today, -1) : ctx.today;

  const withoutAmount = text.replace(found.raw, ' ');
  const withoutDate = withoutAmount.replace(/\b(kemarin|kmrn|yesterday)\b/gi, ' ');
  const note = normalizeNote(withoutDate.replace(/\s+/g, ' '));

  const kind = detectKind(text);
  const categoryName = detectCategory(text, ctx.categories);

  return {
    kind,
    amount: found.amount,
    note,
    categoryName,
    date,
    confident:
      Boolean(found.unit) || /[.,]/.test(found.raw) || found.raw.replace(/\D/g, '').length >= 4,
  };
}
