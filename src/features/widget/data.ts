import { getIncomeBetween, getSettings, getSpendByDate, resolveRolloverIn } from '@/db/repo';
import { addDays, startOfWeek, todayISO } from '@/lib/date';
import { buildHomeView, type WeekStartDay } from '@/logic/rollover';
import { closePastWeeks } from '@/logic/weeks';

export interface WidgetData {
  sisaHariIni: number;
  sisaMinggu: number;
}

/** Data ringkas untuk widget. Tidak menjalankan sweep (hindari efek samping di background). */
export async function loadWidgetData(): Promise<WidgetData> {
  const today = todayISO();
  const saved = await getSettings();
  const settings = {
    dailyTarget: saved.dailyTarget,
    weeklyBudget: saved.weeklyBudget,
    weekStart: saved.weekStart as WeekStartDay,
    debtFloor: saved.debtFloor,
    startedOn: saved.startedOn,
  };

  await closePastWeeks(settings, today);

  const weekStart = startOfWeek(today, saved.weekStart);
  const weekEnd = addDays(weekStart, 6);
  const [spendByDate, income, rolloverIn] = await Promise.all([
    getSpendByDate(weekStart, weekEnd),
    getIncomeBetween(weekStart, weekEnd),
    resolveRolloverIn(weekStart),
  ]);

  const home = buildHomeView({ today, settings, rolloverIn, income, spendByDate });

  return {
    sisaHariIni: home.today?.carryOut ?? 0,
    sisaMinggu: home.remainingWeek,
  };
}
