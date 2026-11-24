import { applySavingsSweep, resolveRolloverIn, type Settings } from '@/db/repo';
import { addDays, startOfWeek, type ISODate } from '@/lib/date';
import type { BudgetSettings, WeekStartDay } from '@/logic/rollover';
import { checkSweep } from '@/logic/savings';
import { closePastWeeks } from '@/logic/weeks';

/**
 * Sweep tabungan otomatis: sekali per periode (YYYY-MM), dijalankan pada awal
 * minggu pertama setelah tanggal 1. Transfernya diberi tanggal sehari sebelum
 * awal minggu, sehingga sisa periode lalu tersapu dan minggu baru mulai bersih.
 */
export async function maybeSweepSavings(settings: Settings, today: ISODate): Promise<void> {
  const check = checkSweep({
    today,
    weekStart: settings.weekStart,
    enabled: settings.savingsEnabled,
    lastSweepPeriod: settings.lastSweepPeriod,
  });
  if (!check.due) return;

  const weekStart = startOfWeek(today, settings.weekStart);
  const rollover = await resolveRolloverIn(weekStart);
  const amount = Math.max(0, Math.round(rollover));
  const sweepDate = addDays(weekStart, -1);

  await applySavingsSweep({ period: check.period, amount, date: sweepDate });

  if (amount > 0) {
    const budget: BudgetSettings = {
      dailyTarget: settings.dailyTarget,
      weeklyBudget: settings.weeklyBudget,
      weekStart: settings.weekStart as WeekStartDay,
      debtFloor: settings.debtFloor,
      startedOn: settings.startedOn,
    };
    // Bekukan ulang minggu lalu dengan pengeluaran sweep di dalamnya.
    await closePastWeeks(budget, today);
  }
}
