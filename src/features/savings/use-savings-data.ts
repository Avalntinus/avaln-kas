import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  getIncomeBetween,
  getSavingsBalance,
  getSettings,
  getSpendByDate,
  listSavingsMoves,
  resolveRolloverIn,
  type Transaction,
} from '@/db/repo';
import { addDays, startOfWeek, todayISO } from '@/lib/date';
import { computeWeek, type WeekStartDay } from '@/logic/rollover';
import { closePastWeeks } from '@/logic/weeks';
import { maybeSweepSavings } from './sweep';

export interface SavingsData {
  loading: boolean;
  balance: number;
  /** Sisa minggu berjalan, batas maksimal untuk "Sisihkan". */
  weekRemaining: number;
  sweepEnabled: boolean;
  savingsTarget: number;
  /** Koreksi saldo (tidak memengaruhi jatah mingguan). */
  savingsOffset: number;
  moves: Transaction[];
}

const EMPTY: SavingsData = {
  loading: true,
  balance: 0,
  weekRemaining: 0,
  sweepEnabled: true,
  savingsTarget: 0,
  savingsOffset: 0,
  moves: [],
};

export function useSavingsData(): SavingsData & { refresh: () => void } {
  const [data, setData] = useState<SavingsData>(EMPTY);

  const load = useCallback(async (isCancelled: () => boolean) => {
    {
      const today = todayISO();
      const settings = await getSettings();

      await closePastWeeks(
        {
          dailyTarget: settings.dailyTarget,
          weeklyBudget: settings.weeklyBudget,
          weekStart: settings.weekStart as WeekStartDay,
          debtFloor: settings.debtFloor,
          startedOn: settings.startedOn,
        },
        today,
      );
      await maybeSweepSavings(settings, today);

      const weekStart = startOfWeek(today, settings.weekStart);
      const weekEnd = addDays(weekStart, 6);

      const [spendByDate, income, rolloverIn, balance, moves] = await Promise.all([
        getSpendByDate(weekStart, weekEnd),
        getIncomeBetween(weekStart, weekEnd),
        resolveRolloverIn(weekStart),
        getSavingsBalance(),
        listSavingsMoves(100),
      ]);

      const week = computeWeek({
        weekStartDate: weekStart,
        budget: settings.weeklyBudget,
        rolloverIn,
        income,
        spendByDate,
        debtFloor: settings.debtFloor,
      });

      if (isCancelled()) return;
      setData({
        loading: false,
        balance,
        weekRemaining: week.remaining,
        sweepEnabled: settings.savingsEnabled,
        savingsTarget: settings.savingsTarget,
        savingsOffset: settings.savingsOffset,
        moves,
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const refresh = useCallback(() => {
    void load(() => false);
  }, [load]);

  return { ...data, refresh };
}
