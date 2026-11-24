import { describe, expect, it } from 'vitest';

import { summarizeMonth } from './monthly-summary';

const rows = [
  { kind: 'expense' as const, amount: 25000, isSavings: false, categoryName: 'Makan' },
  { kind: 'expense' as const, amount: 15000, isSavings: false, categoryName: 'Makan' },
  { kind: 'expense' as const, amount: 10000, isSavings: false, categoryName: 'Transport' },
  { kind: 'expense' as const, amount: 5000, isSavings: false, categoryName: null },
  { kind: 'income' as const, amount: 700000, isSavings: false, categoryName: null },
  { kind: 'expense' as const, amount: 20000, isSavings: true, categoryName: null },
  { kind: 'income' as const, amount: 5000, isSavings: true, categoryName: null },
];

describe('summarizeMonth', () => {
  it('memisahkan konsumsi dan perpindahan tabungan', () => {
    expect(summarizeMonth(rows)).toMatchObject({
      expense: 55000,
      income: 700000,
      savedIn: 20000,
      savedOut: 5000,
      net: 645000,
      count: 7,
    });
  });

  it('mengelompokkan pengeluaran per kategori dan mengurutkan terbesar', () => {
    expect(summarizeMonth(rows).categories).toEqual([
      { name: 'Makan', amount: 40000 },
      { name: 'Transport', amount: 10000 },
      { name: 'Tanpa kategori', amount: 5000 },
    ]);
  });

  it('bulan kosong menghasilkan nol', () => {
    expect(summarizeMonth([])).toEqual({
      expense: 0,
      income: 0,
      savedIn: 0,
      savedOut: 0,
      net: 0,
      count: 0,
      categories: [],
    });
  });
});
