import { describe, expect, it } from 'vitest';

import { parseBackup } from './backup';

interface Sample {
  app: string;
  version: number;
  exportedAt: string;
  settings: {
    dailyTarget: number;
    weeklyBudget: number;
    weekStart: number;
    debtFloor: number | null;
  };
  categories: string[];
  transactions: Record<string, unknown>[];
}

function valid(overrides: Partial<Sample> = {}): Sample {
  return {
    app: 'budgeting',
    version: 1,
    exportedAt: '2026-11-23T00:00:00.000Z',
    settings: {
      dailyTarget: 30000,
      weeklyBudget: 210000,
      weekStart: 1,
      debtFloor: -210000,
    },
    categories: ['Makan', 'Transport'],
    transactions: [
      {
        kind: 'expense',
        amount: 15000,
        category: 'Makan',
        note: 'Nasi padang',
        localDate: '2026-11-23',
        occurredAt: 1_795_000_000_000,
      },
      {
        kind: 'income',
        amount: 500000,
        category: null,
        note: 'Gaji',
        localDate: '2026-11-25',
        occurredAt: 1_795_100_000_000,
      },
    ],
    ...overrides,
  };
}

describe('parseBackup', () => {
  it('menerima file yang valid', () => {
    const backup = parseBackup(JSON.stringify(valid()));
    expect(backup.transactions).toHaveLength(2);
    expect(backup.transactions[1]).toMatchObject({ kind: 'income', amount: 500000, category: null });
    expect(backup.settings.weeklyBudget).toBe(210000);
    expect(backup.categories).toEqual(['Makan', 'Transport']);
  });

  it('menolak JSON rusak', () => {
    expect(() => parseBackup('{bukan json')).toThrow(/bukan JSON/i);
  });

  it('menolak file dari aplikasi lain', () => {
    expect(() => parseBackup(JSON.stringify(valid({ app: 'lain' })))).toThrow(/bukan backup/i);
  });

  it('menolak versi yang tidak dikenal', () => {
    expect(() => parseBackup(JSON.stringify(valid({ version: 9 })))).toThrow(/tidak didukung/i);
  });

  it('menolak nominal nol atau negatif', () => {
    const data = valid();
    data.transactions[0].amount = 0;
    expect(() => parseBackup(JSON.stringify(data))).toThrow(/lebih besar dari 0/i);
  });

  it('menolak tanggal yang tidak valid', () => {
    const data = valid();
    data.transactions[0].localDate = '23-11-2026';
    expect(() => parseBackup(JSON.stringify(data))).toThrow(/YYYY-MM-DD/);
  });

  it('menolak jenis transaksi asing', () => {
    const data = valid();
    data.transactions[0].kind = 'transfer';
    expect(() => parseBackup(JSON.stringify(data))).toThrow(/expense atau income/);
  });

  it('menolak hari mulai minggu di luar 0–6', () => {
    const data = valid();
    data.settings.weekStart = 7;
    expect(() => parseBackup(JSON.stringify(data))).toThrow(/0–6/);
  });

  it('mengisi default untuk kind, catatan, dan occurredAt', () => {
    const data = {
      ...valid(),
      categories: [],
      transactions: [
        { amount: 5000, category: 'Jajan', localDate: '2026-11-23' },
      ],
    };
    const backup = parseBackup(JSON.stringify(data));
    expect(backup.transactions[0]).toMatchObject({ kind: 'expense', note: '' });
    expect(backup.transactions[0].occurredAt).toBe(Date.parse('2026-11-23T12:00:00Z'));
    expect(backup.categories).toEqual([]);
  });

  it('membuang kategori duplikat dan nama kosong', () => {
    const backup = parseBackup(
      JSON.stringify(valid({ categories: ['Makan', 'Makan', '  ', 'Transport'] })),
    );
    expect(backup.categories).toEqual(['Makan', 'Transport']);
  });

  it('menerima debtFloor null', () => {
    const data = valid();
    data.settings.debtFloor = null;
    expect(parseBackup(JSON.stringify(data)).settings.debtFloor).toBeNull();
  });

  it('membulatkan nominal pecahan', () => {
    const data = valid();
    data.transactions[0].amount = 15000.6;
    expect(parseBackup(JSON.stringify(data)).transactions[0].amount).toBe(15001);
  });
});
