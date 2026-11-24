import { addDays, startOfWeek, type ISODate } from '../lib/date';

/** Kunci periode tabungan: bulan kalender dari tanggal lokal. */
export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

/**
 * Sweep dijalankan pada awal minggu pertama yang tanggalnya >= tanggal 1.
 * Contoh: 1 Des 2026 (Selasa), minggu mulai Senin -> Senin 7 Des 2026.
 */
export function sweepDateForMonth(date: ISODate, weekStart: number): ISODate {
  const monthStart = `${monthKey(date)}-01`;
  const first = startOfWeek(monthStart, weekStart);
  return first === monthStart ? first : addDays(first, 7);
}

export interface SweepCheck {
  due: boolean;
  /** Periode (YYYY-MM) yang akan ditandai setelah sweep. */
  period: string;
  /** Tanggal eksekusi (awal minggu). */
  date: ISODate;
}

export function checkSweep(input: {
  today: ISODate;
  weekStart: number;
  enabled: boolean;
  lastSweepPeriod: string | null;
}): SweepCheck {
  const period = monthKey(input.today);
  const date = sweepDateForMonth(input.today, input.weekStart);

  if (!input.enabled || input.lastSweepPeriod === period) {
    return { due: false, period, date };
  }

  return { due: input.today >= date, period, date };
}
