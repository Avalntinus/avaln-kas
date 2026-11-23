/**
 * LOGIKA ROLLING BUDGET — inti aplikasi.
 *
 * File ini murni (tanpa React, tanpa SQLite, tanpa RN) supaya bisa diuji.
 * Satu sumber kebenaran: weekly pool. Batas harian diturunkan dari pool.
 *
 *   pool       = weeklyBudget + income + rolloverIn
 *   dailyBase  = pool / 7  (dibulatkan ke 500, sisa pembulatan ke hari terakhir)
 *   available  = dailyBase + carry
 *   carryOut   = available - spent        (boleh negatif = debt)
 *   rolloverOut= pool - spentTotal        (== carryOut hari terakhir)
 */

import { addDays, startOfWeek, weekDates, type ISODate } from '../lib/date';

export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BudgetSettings {
  /** Target harian untuk tampilan default; komputasi memakai weeklyBudget. */
  dailyTarget: number;
  weeklyBudget: number;
  /** 1 = Senin, 0 = Minggu */
  weekStart: WeekStartDay;
  /** Batas bawah rollover. null = tanpa batas. Contoh: -210000 */
  debtFloor: number | null;
}

export type SpendMap = Record<ISODate, number>;

export interface DayPoint {
  date: ISODate;
  index: number;
  /** jatah dasar hari ini (tanpa carry) */
  base: number;
  /** carry dari hari sebelumnya (boleh negatif) */
  carryIn: number;
  /** base + carryIn = "sisa hari ini" di pagi hari */
  available: number;
  spent: number;
  /** available - spent ; menjadi carryIn hari besok */
  carryOut: number;
}

export interface WeekComputation {
  weekStart: ISODate;
  weekEnd: ISODate;
  /** budget dasar dari Settings */
  budget: number;
  /** pemasukan yang masuk di minggu ini */
  income: number;
  rolloverIn: number;
  /** budget + income + rolloverIn */
  pool: number;
  /** jatah dasar untuk hari ke-1..6; hari ke-7 = lastDay */
  dailyBase: number;
  lastDay: number;
  spentTotal: number;
  /** pool - spentTotal, sebelum debtFloor */
  remaining: number;
  /** nilai yang dibawa ke minggu depan, setelah debtFloor */
  rolloverOut: number;
  floorApplied: boolean;
  days: DayPoint[];
}

export type MeterZone = 'accent' | 'warn' | 'danger';

/**
 * Bagi pool jadi 7 jatah harian. Dibulatkan ke 500 rupiah supaya angka enak
 * dibaca; sisa pembulatan masuk ke hari terakhir sehingga total tetap = pool.
 */
export function splitDaily(pool: number): { base: number; lastDay: number } {
  if (!Number.isFinite(pool) || pool <= 0) {
    return { base: 0, lastDay: Math.round(pool) || 0 };
  }
  const exact = pool / 7;
  let base = exact >= 3500 ? Math.round(exact / 500) * 500 : Math.floor(exact);
  // jangan sampai 6 hari pertama menghabiskan lebih dari pool
  if (base * 6 > pool) base = Math.floor(exact);
  if (base < 0) base = 0;
  return { base, lastDay: pool - base * 6 };
}

export function computeWeek(input: {
  weekStartDate: ISODate;
  budget: number;
  rolloverIn: number;
  /** total pemasukan minggu ini; menambah pool */
  income?: number;
  spendByDate?: SpendMap;
  debtFloor?: number | null;
}): WeekComputation {
  const spendByDate = input.spendByDate ?? {};
  const debtFloor = input.debtFloor ?? null;
  const income = Math.round(input.income ?? 0);
  const pool = Math.round(input.budget) + income + Math.round(input.rolloverIn);
  const { base, lastDay } = splitDaily(pool);
  const dates = weekDates(input.weekStartDate);

  const days: DayPoint[] = [];
  let carry = 0;
  let spentTotal = 0;

  dates.forEach((date, index) => {
    const dayBase = index === 6 ? lastDay : base;
    const available = dayBase + carry;
    const raw = spendByDate[date] ?? 0;
    const spent = raw > 0 ? Math.round(raw) : 0;
    const carryOut = available - spent;

    days.push({ date, index, base: dayBase, carryIn: carry, available, spent, carryOut });
    carry = carryOut;
    spentTotal += spent;
  });

  const remaining = pool - spentTotal;
  const rolloverOut =
    debtFloor === null ? remaining : Math.max(remaining, Math.round(debtFloor));

  return {
    weekStart: input.weekStartDate,
    weekEnd: dates[6],
    budget: Math.round(input.budget),
    income,
    rolloverIn: Math.round(input.rolloverIn),
    pool,
    dailyBase: base,
    lastDay,
    spentTotal,
    remaining,
    rolloverOut,
    floorApplied: rolloverOut !== remaining,
    days,
  };
}

export interface HomeView {
  week: WeekComputation;
  today: DayPoint | null;
  /** base + carryIn untuk hari ini */
  availableToday: number;
  spentToday: number;
  /** pool - spentTotal (boleh negatif) */
  remainingWeek: number;
  usedRatio: number;
  zone: MeterZone;
}

export function buildHomeView(input: {
  today: ISODate;
  settings: BudgetSettings;
  rolloverIn: number;
  income?: number;
  spendByDate?: SpendMap;
}): HomeView {
  const weekStartDate = startOfWeek(input.today, input.settings.weekStart);
  const week = computeWeek({
    weekStartDate,
    budget: input.settings.weeklyBudget,
    rolloverIn: input.rolloverIn,
    income: input.income,
    spendByDate: input.spendByDate,
    debtFloor: input.settings.debtFloor,
  });

  const today = week.days.find((d) => d.date === input.today) ?? null;
  const usedRatio = week.pool > 0 ? week.spentTotal / week.pool : 1;

  return {
    week,
    today,
    availableToday: today?.available ?? 0,
    spentToday: today?.spent ?? 0,
    remainingWeek: week.remaining,
    usedRatio,
    zone: meterZone(usedRatio),
  };
}

export function meterZone(usedRatio: number): MeterZone {
  if (!Number.isFinite(usedRatio)) return 'danger';
  if (usedRatio >= 0.9) return 'danger';
  if (usedRatio >= 0.75) return 'warn';
  return 'accent';
}

/** Kumpulkan transaksi jadi peta tanggal -> total. */
export function spentByDateFrom(
  rows: readonly { localDate: ISODate; amount: number }[],
): SpendMap {
  const map: SpendMap = {};
  for (const row of rows) {
    map[row.localDate] = (map[row.localDate] ?? 0) + Math.round(row.amount);
  }
  return map;
}

/** Rentang tanggal 7 hari untuk satu minggu, dipakai saat query DB. */
export function weekRange(weekStartDate: ISODate): { from: ISODate; to: ISODate } {
  return { from: weekStartDate, to: addDays(weekStartDate, 6) };
}
