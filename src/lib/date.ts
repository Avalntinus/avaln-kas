/**
 * Tanggal disimpan sebagai string 'YYYY-MM-DD' waktu lokal.
 * Parsing/aritmetika dilakukan di UTC supaya bebas DST dan bebas geser zona.
 * String ISO bisa dibandingkan & diurutkan secara leksikografis.
 */

export type ISODate = string;

const MS_PER_DAY = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const HARI_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_PANJANG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function isISODate(value: string): value is ISODate {
  if (!ISO_RE.test(value)) return false;
  const ms = toUtcMs(value);
  return fromUtcMs(ms) === value;
}

function toUtcMs(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): ISODate {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Tanggal lokal hari ini (bukan UTC). */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromUtcMs(toUtcMs(iso) + days * MS_PER_DAY);
}

/** 0 = Minggu ... 6 = Sabtu */
export function dayOfWeek(iso: ISODate): number {
  return new Date(toUtcMs(iso)).getUTCDay();
}

/** Awal minggu yang memuat `iso`. weekStart: 1 = Senin (default). */
export function startOfWeek(iso: ISODate, weekStart = 1): ISODate {
  const dow = dayOfWeek(iso);
  const diff = (dow - weekStart + 7) % 7;
  return addDays(iso, -diff);
}

export function weekDates(start: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function monthStart(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

/** Awal bulan setelah digeser `delta` bulan. */
export function addMonths(iso: ISODate, delta: number): ISODate {
  const [year, month] = iso.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function monthEnd(iso: ISODate): ISODate {
  return addDays(addMonths(iso, 1), -1);
}

/** "November 2026" */
export function formatMonthYear(iso: ISODate): string {
  const [y, m] = iso.split('-').map(Number);
  return `${BULAN_PANJANG[m - 1]} ${y}`;
}

/** "Senin, 23 Nov" */
export function formatLongDate(iso: ISODate): string {
  const dow = dayOfWeek(iso);
  const [, m, d] = iso.split('-').map(Number);
  return `${HARI[dow]}, ${d} ${BULAN[m - 1]}`;
}

/** "Sen, 23 Nov" */
export function formatShortDate(iso: ISODate): string {
  const dow = dayOfWeek(iso);
  const [, m, d] = iso.split('-').map(Number);
  return `${HARI_SHORT[dow]}, ${d} ${BULAN[m - 1]}`;
}

/** "23 Nov" */
export function formatDayMonth(iso: ISODate): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${BULAN[m - 1]}`;
}

export function dayName(iso: ISODate): string {
  return HARI[dayOfWeek(iso)];
}
