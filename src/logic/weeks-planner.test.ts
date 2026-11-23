import { describe, expect, it } from 'vitest';

import { weeksToClose } from './weeks-planner';

describe('weeksToClose', () => {
  it('tidak menutup apa pun kalau transaksi pertama masih di minggu berjalan', () => {
    expect(weeksToClose({ earliest: '2026-11-23', today: '2026-11-23', weekStart: 1 })).toEqual([]);
    expect(weeksToClose({ earliest: '2026-11-29', today: '2026-11-29', weekStart: 1 })).toEqual([]);
  });

  it('menutup minggu lalu sampai minggu transaksi pertama, terbaru dulu', () => {
    expect(weeksToClose({ earliest: '2026-11-02', today: '2026-11-23', weekStart: 1 })).toEqual([
      '2026-11-16',
      '2026-11-09',
      '2026-11-02',
    ]);
  });

  it('memakai awal minggu dari tanggal transaksi, bukan tanggal persisnya', () => {
    expect(weeksToClose({ earliest: '2026-11-04', today: '2026-11-23', weekStart: 1 })).toEqual([
      '2026-11-16',
      '2026-11-09',
      '2026-11-02',
    ]);
  });

  it('menghormati minggu yang mulai hari Minggu', () => {
    expect(weeksToClose({ earliest: '2026-11-04', today: '2026-11-23', weekStart: 0 })).toEqual([
      '2026-11-15',
      '2026-11-08',
      '2026-11-01',
    ]);
  });

  it('hari Minggu masih bagian minggu yang mulai Senin', () => {
    // 2026-11-29 = Minggu; minggu 23–29 belum lewat.
    expect(weeksToClose({ earliest: '2026-11-16', today: '2026-11-29', weekStart: 1 })).toEqual([
      '2026-11-16',
    ]);
    // Kalau minggu mulai hari Minggu, 29 Nov sudah minggu baru → 16 Nov lewat.
    expect(weeksToClose({ earliest: '2026-11-16', today: '2026-11-29', weekStart: 0 })).toEqual([
      '2026-11-22',
      '2026-11-15',
    ]);
  });

  it('tidak menutup minggu sebelum app mulai dipakai', () => {
    expect(
      weeksToClose({
        earliest: '2026-11-02',
        today: '2026-11-23',
        weekStart: 1,
        notBefore: '2026-11-23',
      }),
    ).toEqual([]);

    expect(
      weeksToClose({
        earliest: '2026-11-02',
        today: '2026-11-23',
        weekStart: 1,
        notBefore: '2026-11-09',
      }),
    ).toEqual(['2026-11-16', '2026-11-09']);
  });

  it('dibatasi maxWeeks supaya tidak berputar selamanya', () => {
    const weeks = weeksToClose({
      earliest: '2020-01-01',
      today: '2026-11-23',
      weekStart: 1,
      maxWeeks: 3,
    });
    expect(weeks).toEqual(['2026-11-16', '2026-11-09', '2026-11-02']);
  });

  it('melintasi pergantian tahun', () => {
    expect(weeksToClose({ earliest: '2026-12-21', today: '2027-01-11', weekStart: 1 })).toEqual([
      '2027-01-04',
      '2026-12-28',
      '2026-12-21',
    ]);
  });
});
