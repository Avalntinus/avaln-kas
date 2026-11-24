import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  getIncomeBetween,
  getSavingsBalance,
  getSettings,
  getSpendByDate,
  listTransactionsByDate,
  resolveRolloverIn,
  type Transaction,
} from '@/db/repo';
import { addDays, startOfWeek, todayISO, type ISODate } from '@/lib/date';
import {
  buildHomeView,
  type BudgetSettings,
  type HomeView,
  type WeekStartDay,
} from '@/logic/rollover';
import { maybeSweepSavings } from '@/features/savings/sweep';
import { closePastWeeks } from '@/logic/weeks';

export interface HomeData {
  loading: boolean;
  error: string | null;
  home: HomeView | null;
  today: ISODate;
  transactions: Transaction[];
  savingsBalance: number;
  /** true = belum pernah mengatur budget, arahkan ke layar sambutan */
  needsSetup: boolean;
}

const EMPTY: HomeData = {
  loading: true,
  error: null,
  home: null,
  today: todayISO(),
  transactions: [],
  savingsBalance: 0,
  needsSetup: false,
};

/**
 * Data Home selalu dihitung ulang saat layar difokuskan, supaya transaksi baru
 * (atau hasil edit dari Riwayat) langsung terlihat tanpa restart app.
 */
export function useHomeData(): HomeData {
  const [data, setData] = useState<HomeData>(EMPTY);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          const today = todayISO();
          const settings = await getSettings();
          const weekStartDate = startOfWeek(today, settings.weekStart);

          const budgetSettings: BudgetSettings = {
            dailyTarget: settings.dailyTarget,
            weeklyBudget: settings.weeklyBudget,
            weekStart: settings.weekStart as WeekStartDay,
            debtFloor: settings.debtFloor,
            startedOn: settings.startedOn,
          };

          // Bekukan minggu lalu dulu supaya rolloverIn minggu ini tidak 0.
          await closePastWeeks(budgetSettings, today);
          await maybeSweepSavings(settings, today);

          const weekEnd = addDays(weekStartDate, 6);
          const [spendByDate, income, rolloverIn, transactions, savingsBalance] = await Promise.all(
            [
              getSpendByDate(weekStartDate, weekEnd),
              getIncomeBetween(weekStartDate, weekEnd),
              resolveRolloverIn(weekStartDate),
              listTransactionsByDate(today),
              getSavingsBalance(),
            ],
          );

          const home = buildHomeView({
            today,
            settings: budgetSettings,
            rolloverIn,
            income,
            spendByDate,
          });

          if (cancelled) return;
          setData({
            loading: false,
            error: null,
            home,
            today,
            transactions,
            savingsBalance,
            needsSetup: !settings.onboarded,
          });
        } catch (error) {
          if (cancelled) return;
          setData({
            ...EMPTY,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  return data;
}
