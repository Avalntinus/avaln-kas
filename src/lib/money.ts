/**
 * Semua nominal adalah integer rupiah. Tidak ada float untuk uang.
 * Format manual (tanpa Intl) supaya hasilnya sama di Hermes dan di Node/test.
 */

const GROUP_RE = /\B(?=(\d{3})+(?!\d))/g;
const MINUS = '\u2212'; // − (bukan hyphen, biar sejajar dengan tabular nums)

export function groupDigits(digits: string): string {
  return digits.replace(GROUP_RE, '.');
}

/** 25000 -> "Rp 25.000" ; -7000 -> "−Rp 7.000" */
export function formatRp(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? MINUS : '';
  return `${sign}Rp ${groupDigits(Math.abs(rounded).toString())}`;
}

/** 8000 -> "+Rp 8.000" ; -7000 -> "−Rp 7.000" ; 0 -> "Rp 0" */
export function formatSignedRp(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return 'Rp 0';
  const sign = rounded > 0 ? '+' : MINUS;
  return `${sign}Rp ${groupDigits(Math.abs(rounded).toString())}`;
}

/** Digit mentah dari keypad ("25000") -> "25.000" */
export function formatDigits(digits: string): string {
  const clean = digits.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (clean === '') return '';
  return groupDigits(clean);
}

/** Digit keypad -> integer rupiah. "25000" -> 25000 */
export function digitsToAmount(digits: string): number {
  const clean = digits.replace(/\D/g, '');
  if (clean === '') return 0;
  return Number.parseInt(clean, 10);
}

/** Baris teks catatan -> aman disimpan (trim + batas panjang) */
export function normalizeNote(input: string, maxLength = 120): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
