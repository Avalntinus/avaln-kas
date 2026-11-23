import { addDays, isISODate, type ISODate } from '../lib/date';
import { normalizeNote } from '../lib/money';
import type { QuickCategory, QuickKind } from '../logic/quick-add';

export interface AiQuickParse {
  kind: QuickKind;
  amount: number;
  note: string;
  categoryName: string | null;
  date: ISODate;
}

const MAX_AMOUNT = 1_000_000_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validasi output AI. AI tidak boleh langsung dipercaya: kalau bentuknya salah,
 * kembalikan null supaya UI meminta input manual.
 */
export function validateAiQuick(
  raw: unknown,
  ctx: { today: ISODate; categories: readonly QuickCategory[] },
): AiQuickParse | null {
  if (!isRecord(raw)) return null;

  const kind = raw.kind;
  if (kind !== 'expense' && kind !== 'income') return null;

  const amount = raw.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  const rounded = Math.round(amount);
  if (rounded <= 0 || rounded >= MAX_AMOUNT) return null;

  const dateRaw = raw.date;
  let date: ISODate;
  if (dateRaw === 'yesterday') date = addDays(ctx.today, -1);
  else if (dateRaw === 'today' || dateRaw === undefined) date = ctx.today;
  else if (typeof dateRaw === 'string' && isISODate(dateRaw)) date = dateRaw;
  else return null;

  const note = typeof raw.note === 'string' ? normalizeNote(raw.note) : '';

  let categoryName: string | null = null;
  if (typeof raw.category === 'string' && raw.category.trim() !== '') {
    const wanted = raw.category.trim().toLowerCase();
    categoryName = ctx.categories.find((c) => c.name.toLowerCase() === wanted)?.name ?? null;
  }

  return { kind, amount: rounded, note, categoryName, date };
}
