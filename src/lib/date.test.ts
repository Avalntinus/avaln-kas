import { describe, expect, it } from 'vitest';

import { addMonths, monthEnd, monthStart, formatMonthYear } from './date';

describe('month helpers', () => {
  it('menggeser bulan melewati pergantian tahun', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
    expect(addMonths('2026-11-24', 0)).toBe('2026-11-01');
  });

  it('menghitung akhir bulan termasuk Februari kabisat', () => {
    expect(monthEnd('2026-11-24')).toBe('2026-11-30');
    expect(monthEnd('2027-02-10')).toBe('2027-02-28');
    expect(monthEnd('2028-02-10')).toBe('2028-02-29');
  });

  it('memformat nama bulan', () => {
    expect(formatMonthYear('2026-11-24')).toBe('November 2026');
    expect(monthStart('2026-11-24')).toBe('2026-11-01');
  });
});
