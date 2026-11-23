import type { Transaction } from '../db/repo';

/**
 * Label baris transaksi: catatan dulu, lalu nama kategori, terakhir placeholder.
 * Pemasukan tidak punya kategori, jadi placeholder-nya "Pemasukan".
 */
export function transactionLabel(
  tx: Pick<Transaction, 'note' | 'categoryName' | 'kind'>,
): string {
  const note = tx.note.trim();
  if (note !== '') return note;
  if (tx.categoryName) return tx.categoryName;
  return tx.kind === 'income' ? 'Pemasukan' : 'Tanpa catatan';
}
