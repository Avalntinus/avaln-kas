import { addDays, startOfWeek, type ISODate } from '../lib/date';
import type { WeekStartDay } from './rollover';

/** Pengaman: maksimal 2 tahun ke belakang. */
export const MAX_WEEKS = 104;

/**
 * Daftar minggu yang perlu dibekukan, dari yang paling baru ke paling lama.
 * Minggu berjalan sengaja tidak termasuk: selalu dihitung live.
 *
 * Murni (tanpa DB) supaya bisa diuji.
 */
export function weeksToClose(input: {
  earliest: ISODate;
  today: ISODate;
  weekStart: WeekStartDay;
  /** Jangan menutup minggu sebelum awal minggu tanggal ini. */
  notBefore?: ISODate;
  maxWeeks?: number;
}): ISODate[] {
  const maxWeeks = input.maxWeeks ?? MAX_WEEKS;
  const currentStart = startOfWeek(input.today, input.weekStart);
  const firstStart = startOfWeek(input.earliest, input.weekStart);
  const lowerBound = input.notBefore && input.notBefore > firstStart ? input.notBefore : firstStart;

  const weeks: ISODate[] = [];
  let cursor = addDays(currentStart, -7);
  let guard = 0;

  while (cursor >= lowerBound && guard < maxWeeks) {
    weeks.push(cursor);
    cursor = addDays(cursor, -7);
    guard += 1;
  }

  return weeks;
}
