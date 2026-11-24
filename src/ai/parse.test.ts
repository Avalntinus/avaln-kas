import { describe, expect, it } from 'vitest';

import { validateAiQuick } from './parse';

const TODAY = '2026-11-23';
const categories = [
  { id: 1, name: 'Makan' },
  { id: 2, name: 'Transport' },
  { id: 3, name: 'Jajan' },
  { id: 4, name: 'Lainnya' },
];

const ctx = { today: TODAY, categories };

describe('validateAiQuick', () => {
  it('menerima output yang valid', () => {
    expect(
      validateAiQuick(
        { kind: 'expense', amount: 25000, note: 'makan siang', category: 'makan', date: 'today' },
        ctx,
      ),
    ).toEqual({
      kind: 'expense',
      amount: 25000,
      note: 'makan siang',
      categoryName: 'Makan',
      date: TODAY,
    });
  });

  it('menerjemahkan kemarin', () => {
    expect(
      validateAiQuick({ kind: 'income', amount: 500000, note: 'gaji', date: 'yesterday' }, ctx)
        ?.date,
    ).toBe('2026-11-22');
  });

  it('menerima tanggal ISO langsung', () => {
    expect(
      validateAiQuick({ kind: 'expense', amount: 1000, note: 'x', date: '2026-11-20' }, ctx)?.date,
    ).toBe('2026-11-20');
  });

  it('menolak jenis, nominal, dan tanggal yang salah', () => {
    expect(validateAiQuick({ kind: 'transfer', amount: 1000, note: '' }, ctx)).toBeNull();
    expect(validateAiQuick({ kind: 'expense', amount: 0, note: '' }, ctx)).toBeNull();
    expect(validateAiQuick({ kind: 'expense', amount: -5, note: '' }, ctx)).toBeNull();
    expect(
      validateAiQuick({ kind: 'expense', amount: 1000, note: '', date: '23-11-2026' }, ctx),
    ).toBeNull();
    expect(validateAiQuick('bukan objek', ctx)).toBeNull();
    expect(validateAiQuick(null, ctx)).toBeNull();
  });

  it('mengabaikan kategori di luar daftar', () => {
    expect(
      validateAiQuick({ kind: 'expense', amount: 5000, note: 'x', category: 'Hadiah' }, ctx)
        ?.categoryName,
    ).toBeNull();
  });

  it('membulatkan nominal dan merapikan catatan', () => {
    const result = validateAiQuick(
      { kind: 'expense', amount: 25000.6, note: '  makan   siang ' },
      ctx,
    );
    expect(result?.amount).toBe(25001);
    expect(result?.note).toBe('makan siang');
  });
});
