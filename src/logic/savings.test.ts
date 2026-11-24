import { describe, expect, it } from 'vitest';

import { checkSweep, monthKey, sweepDateForMonth } from './savings';

describe('savings', () => {
  it('mengambil kunci bulan', () => {
    expect(monthKey('2026-11-24')).toBe('2026-11');
    expect(monthKey('2027-01-01')).toBe('2027-01');
  });

  it('sweep pada awal minggu pertama setelah tanggal 1', () => {
    // 1 Des 2026 = Selasa -> Senin 7 Des
    expect(sweepDateForMonth('2026-12-01', 1)).toBe('2026-12-07');
    // 1 Nov 2026 = Minggu -> Senin 2 Nov
    expect(sweepDateForMonth('2026-11-01', 1)).toBe('2026-11-02');
    // 1 Jun 2026 = Senin -> langsung 1 Jun
    expect(sweepDateForMonth('2026-06-01', 1)).toBe('2026-06-01');
  });

  it('menghormati minggu yang mulai hari Minggu', () => {
    // 1 Nov 2026 = Minggu, minggu mulai Minggu -> 1 Nov
    expect(sweepDateForMonth('2026-11-01', 0)).toBe('2026-11-01');
    // 1 Des 2026 = Selasa -> Minggu 6 Des
    expect(sweepDateForMonth('2026-12-01', 0)).toBe('2026-12-06');
  });

  it('belum jatuh tempo sebelum tanggal eksekusi', () => {
    const base = {
      weekStart: 1,
      enabled: true,
      lastSweepPeriod: null,
    };
    expect(checkSweep({ ...base, today: '2026-12-06' }).due).toBe(false);
    expect(checkSweep({ ...base, today: '2026-12-07' }).due).toBe(true);
    expect(checkSweep({ ...base, today: '2026-12-20' }).due).toBe(true);
  });

  it('tidak berulang setelah periode ditandai', () => {
    expect(
      checkSweep({
        today: '2026-12-20',
        weekStart: 1,
        enabled: true,
        lastSweepPeriod: '2026-12',
      }).due,
    ).toBe(false);
  });

  it('bisa dimatikan', () => {
    expect(
      checkSweep({
        today: '2026-12-20',
        weekStart: 1,
        enabled: false,
        lastSweepPeriod: null,
      }).due,
    ).toBe(false);
  });

  it('periode mengikuti bulan berjalan', () => {
    expect(
      checkSweep({
        today: '2027-01-09',
        weekStart: 1,
        enabled: true,
        lastSweepPeriod: '2026-12',
      }),
    ).toMatchObject({ due: true, period: '2027-01', date: '2027-01-04' });
  });
});
