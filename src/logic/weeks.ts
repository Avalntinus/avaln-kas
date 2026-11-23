import {
  getEarliestTransactionDate,
  getIncomeBetween,
  getSpendByDate,
  getWeekRow,
  upsertWeekRow,
} from '../db/repo';
import { addDays, type ISODate } from '../lib/date';
import { computeWeek, type BudgetSettings } from './rollover';
import { weeksToClose } from './weeks-planner';

/**
 * Bekukan minggu yang sudah lewat ke tabel `weeks` (dari yang terbaru mundur).
 * Minggu berjalan TIDAK disimpan — selalu dihitung live supaya tidak pernah basi.
 * Kalau minggu lalu belum dibekukan, `resolveRolloverIn` akan mengembalikan 0 dan
 * angka Home salah, jadi fungsi ini dipanggil sebelum membaca data Home.
 */
export async function closePastWeeks(settings: BudgetSettings, today: ISODate): Promise<void> {
  const earliest = await getEarliestTransactionDate();
  if (!earliest) return;

  const weeks = weeksToClose({
    earliest,
    today,
    weekStart: settings.weekStart,
  });

  for (const weekStart of weeks) {
    const existing = await getWeekRow(weekStart);
    if (existing?.closed) break;

    const previous = await getWeekRow(addDays(weekStart, -7));
    const rolloverIn = previous?.rolloverOut ?? 0;
    const end = addDays(weekStart, 6);
    const [spendByDate, income] = await Promise.all([
      getSpendByDate(weekStart, end),
      getIncomeBetween(weekStart, end),
    ]);
    const week = computeWeek({
      weekStartDate: weekStart,
      budget: settings.weeklyBudget,
      rolloverIn,
      income,
      spendByDate,
      debtFloor: settings.debtFloor,
    });

    await upsertWeekRow({
      weekStart,
      // budget tersimpan = budget dasar + pemasukan minggu itu
      budget: settings.weeklyBudget + income,
      rolloverIn,
      spent: week.spentTotal,
      rolloverOut: week.rolloverOut,
      closed: true,
    });
  }
}
