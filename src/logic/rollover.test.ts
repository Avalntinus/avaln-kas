import { describe, expect, it } from 'vitest';

import {
  buildHomeView,
  computeWeek,
  meterZone,
  spentByDateFrom,
  splitDaily,
  type BudgetSettings,
} from './rollover';
import { addDays, startOfWeek } from '../lib/date';

const SENIN = '2026-11-23';

const settings: BudgetSettings = {
  dailyTarget: 30000,
  weeklyBudget: 210000,
  weekStart: 1,
  debtFloor: -210000,
};

describe('splitDaily', () => {
  it('membagi pool sehingga total 7 hari selalu = pool', () => {
    const pools = [210000, 233000, 200000, 100000, 3500, 3499, 123456, 7, 1];
    for (const pool of pools) {
      const { base, lastDay } = splitDaily(pool);
      expect(base * 6 + lastDay).toBe(pool);
      expect(base).toBeGreaterThanOrEqual(0);
    }
  });

  it('membulatkan ke 500 untuk angka yang enak dibaca', () => {
    expect(splitDaily(210000)).toEqual({ base: 30000, lastDay: 30000 });
    expect(splitDaily(233000)).toEqual({ base: 33500, lastDay: 32000 });
    expect(splitDaily(160000)).toEqual({ base: 23000, lastDay: 22000 });
  });

  it('tidak menghasilkan jatah negatif saat pool minus', () => {
    expect(splitDaily(-40000)).toEqual({ base: 0, lastDay: -40000 });
  });
});

describe('computeWeek — tabel acuan 7 hari', () => {
  const spendByDate = {
    '2026-11-23': 22000,
    '2026-11-24': 45000,
    '2026-11-25': 20000,
    '2026-11-26': 40000,
    '2026-11-27': 10000,
    '2026-11-28': 50000,
    '2026-11-29': 0,
  };

  const week = computeWeek({
    weekStartDate: SENIN,
    budget: 210000,
    rolloverIn: 0,
    spendByDate,
    debtFloor: settings.debtFloor,
  });

  it('available tiap hari sesuai carry chain', () => {
    expect(week.days.map((d) => d.available)).toEqual([
      30000, 38000, 23000, 33000, 23000, 43000, 23000,
    ]);
  });

  it('carryOut tiap hari sesuai skenario debt mode', () => {
    expect(week.days.map((d) => d.carryOut)).toEqual([
      8000, -7000, 3000, -7000, 13000, -7000, 23000,
    ]);
  });

  it('total belanja dan rollover akhir benar', () => {
    expect(week.spentTotal).toBe(187000);
    expect(week.remaining).toBe(23000);
    expect(week.rolloverOut).toBe(23000);
    expect(week.floorApplied).toBe(false);
  });

  it('carryOut hari terakhir selalu sama dengan remaining', () => {
    expect(week.days[6].carryOut).toBe(week.remaining);
  });

  it('pool minggu depan = budget + rolloverOut', () => {
    const next = computeWeek({
      weekStartDate: '2026-11-30',
      budget: 210000,
      rolloverIn: week.rolloverOut,
      debtFloor: settings.debtFloor,
    });
    expect(next.pool).toBe(233000);
    expect(next.dailyBase).toBe(33500);
    expect(next.days[0].available).toBe(33500);
  });
});

describe('computeWeek — debt & floor', () => {
  it('overspend terbawa sebagai minus tanpa kena floor', () => {
    const week = computeWeek({
      weekStartDate: SENIN,
      budget: 210000,
      rolloverIn: 0,
      spendByDate: { [SENIN]: 300000 },
      debtFloor: -210000,
    });
    expect(week.remaining).toBe(-90000);
    expect(week.rolloverOut).toBe(-90000);
    expect(week.floorApplied).toBe(false);
  });

  it('minus dibatasi debtFloor', () => {
    const week = computeWeek({
      weekStartDate: SENIN,
      budget: 210000,
      rolloverIn: 0,
      spendByDate: { [SENIN]: 500000 },
      debtFloor: -210000,
    });
    expect(week.remaining).toBe(-290000);
    expect(week.rolloverOut).toBe(-210000);
    expect(week.floorApplied).toBe(true);
  });

  it('minus tepat di floor tidak dianggap terpotong', () => {
    const week = computeWeek({
      weekStartDate: SENIN,
      budget: 210000,
      rolloverIn: 0,
      spendByDate: { [SENIN]: 420000 },
      debtFloor: -210000,
    });
    expect(week.remaining).toBe(-210000);
    expect(week.rolloverOut).toBe(-210000);
    expect(week.floorApplied).toBe(false);
  });

  it('tanpa debtFloor minus tidak dibatasi', () => {
    const week = computeWeek({
      weekStartDate: SENIN,
      budget: 210000,
      rolloverIn: 0,
      spendByDate: { [SENIN]: 1000000 },
      debtFloor: null,
    });
    expect(week.rolloverOut).toBe(-790000);
  });

  it('rolloverIn negatif mengecilkan pool dan jatah harian', () => {
    const week = computeWeek({
      weekStartDate: SENIN,
      budget: 210000,
      rolloverIn: -50000,
      debtFloor: -210000,
    });
    expect(week.pool).toBe(160000);
    expect(week.days[0].available).toBe(23000);
  });

  it('pool negatif tidak menghasilkan jatah negatif', () => {
    const week = computeWeek({
      weekStartDate: SENIN,
      budget: 10000,
      rolloverIn: -50000,
      debtFloor: -210000,
    });
    expect(week.pool).toBe(-40000);
    expect(week.days[0].available).toBe(0);
    expect(week.days[6].available).toBe(-40000);
  });
});

describe('computeWeek — minggu kosong', () => {
  it('seluruh pool terbawa ke minggu depan', () => {
    const week = computeWeek({
      weekStartDate: SENIN,
      budget: 210000,
      rolloverIn: 0,
      debtFloor: -210000,
    });
    expect(week.spentTotal).toBe(0);
    expect(week.rolloverOut).toBe(210000);
  });
});

describe('rentang tanggal', () => {
  it('startOfWeek menarik ke Senin', () => {
    expect(startOfWeek('2026-11-26', 1)).toBe(SENIN);
    expect(startOfWeek('2026-11-23', 1)).toBe(SENIN);
    expect(startOfWeek('2026-11-29', 1)).toBe(SENIN);
  });

  it('startOfWeek bisa memakai Minggu', () => {
    expect(startOfWeek('2026-11-26', 0)).toBe('2026-11-22');
  });

  it('minggu bisa melewati batas bulan', () => {
    const week = computeWeek({
      weekStartDate: '2026-11-30',
      budget: 210000,
      rolloverIn: 0,
      debtFloor: -210000,
    });
    expect(week.weekEnd).toBe('2026-12-06');
    expect(week.days).toHaveLength(7);
  });

  it('addDays lintas tahun', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('meterZone', () => {
  it('ambang 75% dan 90%', () => {
    expect(meterZone(0)).toBe('accent');
    expect(meterZone(0.749)).toBe('accent');
    expect(meterZone(0.75)).toBe('warn');
    expect(meterZone(0.899)).toBe('warn');
    expect(meterZone(0.9)).toBe('danger');
    expect(meterZone(1.4)).toBe('danger');
  });

  it('ratio tidak valid dianggap danger', () => {
    expect(meterZone(Number.NaN)).toBe('danger');
  });
});

describe('computeWeek — pemasukan', () => {
  it('pemasukan menambah pool dan jatah harian', () => {
    const week = computeWeek({
      weekStartDate: SENIN,
      budget: 210000,
      rolloverIn: 0,
      income: 50000,
      spendByDate: { [SENIN]: 30000 },
      debtFloor: settings.debtFloor,
    });

    expect(week.budget).toBe(210000);
    expect(week.income).toBe(50000);
    expect(week.pool).toBe(260000);
    expect(week.dailyBase).toBe(37000);
    expect(week.lastDay).toBe(38000);
    expect(week.days[0].carryOut).toBe(7000);
    expect(week.remaining).toBe(230000);
    expect(week.rolloverOut).toBe(230000);
  });

  it('pemasukan tidak menghapus debt floor', () => {
    const week = computeWeek({
      weekStartDate: SENIN,
      budget: 210000,
      rolloverIn: 0,
      income: 50000,
      spendByDate: { [SENIN]: 300000 },
      debtFloor: -210000,
    });

    expect(week.remaining).toBe(-40000);
    expect(week.rolloverOut).toBe(-40000);
    expect(week.floorApplied).toBe(false);
  });

  it('buildHomeView meneruskan pemasukan ke pool minggu ini', () => {
    const home = buildHomeView({
      today: SENIN,
      settings,
      rolloverIn: 0,
      income: 70000,
    });
    expect(home.week.pool).toBe(280000);
    expect(home.availableToday).toBe(40000);
    expect(home.remainingWeek).toBe(280000);
  });
});

describe('buildHomeView', () => {
  it('menghitung sisa hari ini di tengah minggu', () => {
    const home = buildHomeView({
      today: '2026-11-26',
      settings,
      rolloverIn: 0,
      spendByDate: { [SENIN]: 22000 },
    });

    expect(home.today?.date).toBe('2026-11-26');
    expect(home.availableToday).toBe(98000);
    expect(home.spentToday).toBe(0);
    expect(home.remainingWeek).toBe(188000);
    expect(home.zone).toBe('accent');
  });

  it('rolloverIn dipakai untuk pool minggu berjalan', () => {
    const home = buildHomeView({
      today: '2026-11-23',
      settings,
      rolloverIn: 23000,
    });
    expect(home.week.pool).toBe(233000);
    expect(home.availableToday).toBe(33500);
  });

  it('menempatkan hari ini pada index yang benar', () => {
    const home = buildHomeView({ today: '2026-11-26', settings, rolloverIn: 0 });
    expect(home.today?.index).toBe(3);
  });
});

describe('spentByDateFrom', () => {
  it('menjumlahkan beberapa transaksi di tanggal yang sama', () => {
    const map = spentByDateFrom([
      { localDate: '2026-11-23', amount: 15000 },
      { localDate: '2026-11-23', amount: 10000 },
      { localDate: '2026-11-24', amount: 5000 },
    ]);
    expect(map).toEqual({
      '2026-11-23': 25000,
      '2026-11-24': 5000,
    });
  });
});
