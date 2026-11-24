import type { Transaction } from '../db/repo';

export interface CategoryTotal {
  name: string;
  amount: number;
}

export interface MonthSummary {
  expense: number;
  income: number;
  /** Disisihkan ke tabungan pada bulan itu. */
  savedIn: number;
  /** Ditarik dari tabungan pada bulan itu. */
  savedOut: number;
  /** income − expense (konsumsi), tidak termasuk perpindahan tabungan. */
  net: number;
  count: number;
  categories: CategoryTotal[];
}

export function summarizeMonth(
  rows: readonly Pick<Transaction, 'kind' | 'amount' | 'isSavings' | 'categoryName'>[],
): MonthSummary {
  let expense = 0;
  let income = 0;
  let savedIn = 0;
  let savedOut = 0;
  let count = 0;
  const byCategory = new Map<string, number>();

  for (const row of rows) {
    count += 1;

    if (row.isSavings) {
      if (row.kind === 'expense') savedIn += row.amount;
      else savedOut += row.amount;
      continue;
    }

    if (row.kind === 'expense') {
      expense += row.amount;
      const name = row.categoryName ?? 'Tanpa kategori';
      byCategory.set(name, (byCategory.get(name) ?? 0) + row.amount);
    } else {
      income += row.amount;
    }
  }

  const categories = [...byCategory.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    expense,
    income,
    savedIn,
    savedOut,
    net: income - expense,
    count,
    categories,
  };
}
