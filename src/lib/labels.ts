import type { Transaction } from '../db/repo';

/**
 * Label baris transaksi: catatan dulu, lalu nama kategori, terakhir placeholder.
 * Perpindahan tabungan punya label sendiri supaya tidak terbaca sebagai konsumsi.
 */
export function transactionLabel(
  tx: Pick<Transaction, 'note' | 'categoryName' | 'kind' | 'isSavings'>,
): string {
  if (tx.isSavings) {
    const base = tx.kind === 'expense' ? 'Ke tabungan' : 'Dari tabungan';
    const note = tx.note.trim();
    if (
      note === '' ||
      note === 'Sweep tabungan' ||
      note === 'Sisihkan manual' ||
      note === 'Tarik tabungan'
    ) {
      return base;
    }
    return `${base} · ${note}`;
  }

  const note = tx.note.trim();
  if (note !== '') return note;
  if (tx.categoryName) return tx.categoryName;
  return tx.kind === 'income' ? 'Pemasukan' : 'Tanpa catatan';
}
