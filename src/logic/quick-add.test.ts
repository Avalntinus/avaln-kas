import { describe, expect, it } from 'vitest';

import { parseQuickAdd } from './quick-add';

const TODAY = '2026-11-23';
const categories = [
  { id: 1, name: 'Makan' },
  { id: 2, name: 'Transport' },
  { id: 3, name: 'Jajan' },
  { id: 4, name: 'Lainnya' },
];

function parse(text: string) {
  return parseQuickAdd(text, { today: TODAY, categories });
}

describe('parseQuickAdd', () => {
  it('mengenali pengeluaran dengan satuan rb', () => {
    expect(parse('makan siang 25rb')).toMatchObject({
      kind: 'expense',
      amount: 25000,
      categoryName: 'Makan',
      note: 'makan siang',
      date: TODAY,
      confident: true,
    });
  });

  it('mengenali gaji sebagai pemasukan dan juta desimal', () => {
    expect(parse('gaji 1,5jt')).toMatchObject({
      kind: 'income',
      amount: 1_500_000,
      categoryName: null,
      note: 'gaji',
    });
    expect(parse('gaji 1.5jt')?.amount).toBe(1_500_000);
  });

  it('mengenali pemisah ribuan tanpa satuan', () => {
    expect(parse('bayar listrik 250.000')).toMatchObject({
      amount: 250000,
      categoryName: null,
      note: 'bayar listrik',
    });
  });

  it('mengenali nominal polos minimal tiga digit', () => {
    expect(parse('parkir 5000')?.amount).toBe(5000);
    expect(parse('parkir 5000')?.categoryName).toBe('Transport');
  });

  it('menolak nominal yang terlalu ambigu', () => {
    expect(parse('makan 25')).toBeNull();
    expect(parse('makan 5')).toBeNull();
    expect(parse('makan siang')).toBeNull();
    expect(parse('gaji')).toBeNull();
    expect(parse('')).toBeNull();
  });

  it('memetakan tanggal kemarin', () => {
    expect(parse('kemarin bensin 50.000')).toMatchObject({
      amount: 50000,
      categoryName: 'Transport',
      date: '2026-11-22',
      note: 'bensin',
    });
  });

  it('membedakan kategori Jajan dan Makan', () => {
    expect(parse('kopi 18rb')?.categoryName).toBe('Jajan');
    expect(parse('nasi padang 25rb')?.categoryName).toBe('Makan');
    expect(parse('jajan martabak 30rb')?.categoryName).toBe('Jajan');
  });

  it('mengenali pemasukan dari kata kunci lain', () => {
    expect(parse('bonus 300rb')?.kind).toBe('income');
    expect(parse('jual motor 5jt')?.kind).toBe('income');
    expect(parse('transfer masuk 100rb')?.kind).toBe('income');
  });

  it('menghormati kategori yang tidak ada di database', () => {
    const only = parseQuickAdd('kopi 18rb', { today: TODAY, categories: [{ id: 1, name: 'Makan' }] });
    expect(only?.categoryName).toBeNull();
  });

  it('membersihkan catatan dari nominal dan kata tanggal', () => {
    expect(parse('kemarin beli kopi 18rb')?.note).toBe('beli kopi');
    expect(parse('makan siang 25rb ')?.note).toBe('makan siang');
  });

  it('menangani Rp dan spasi', () => {
    expect(parse('Rp 12.500 parkir')).toMatchObject({ amount: 12500, categoryName: 'Transport' });
  });

  it('angka ribuan dengan titik tetap dianggap ribuan saat ada satuan juta', () => {
    expect(parse('gaji 1.500jt')?.amount).toBe(1_500_000_000);
  });
});
