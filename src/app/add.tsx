import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addTransaction,
  getTransaction,
  listCategories,
  updateTransaction,
  type Category,
  type TransactionKind,
} from '@/db/repo';
import { addDays, formatDayMonth, todayISO, type ISODate } from '@/lib/date';
import { digitsToAmount, formatRp, normalizeNote } from '@/lib/money';
import { color, radius, size, space, type } from '@/theme/tokens';
import { MoneyPad } from '@/ui/money-pad';

const MAX_DIGITS = 12;

/** Dipisah di level modul supaya tidak dianggap pemanggilan impure saat render. */
function nowMs(): number {
  return Date.now();
}

export default function AddScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    amount?: string;
    kind?: string;
    note?: string;
    date?: string;
    categoryId?: string;
  }>();
  const editingId = params.id ? Number(params.id) : null;

  const [kind, setKind] = useState<TransactionKind>('expense');
  const [localDate, setLocalDate] = useState<ISODate>(todayISO());
  const [occurredAt, setOccurredAt] = useState<number>(nowMs);
  const [digits, setDigits] = useState('');
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cats = await listCategories();
      if (cancelled) return;
      setCategories(cats);

      if (editingId) {
        const tx = await getTransaction(editingId);
        if (cancelled || !tx) return;
        setKind(tx.kind);
        setDigits(String(tx.amount));
        setNote(tx.note);
        setCategoryId(tx.categoryId);
        setLocalDate(tx.localDate);
        setOccurredAt(tx.occurredAt);
      } else if (params.amount) {
        // Prefill dari layar Tambah cepat.
        const amount = Number(params.amount);
        if (Number.isFinite(amount) && amount > 0) setDigits(String(Math.round(amount)));
        if (params.kind === 'income') setKind('income');
        if (params.note) setNote(params.note);
        if (params.date) {
          setLocalDate(params.date);
          setOccurredAt(
            params.date === todayISO() ? Date.now() : new Date(`${params.date}T12:00:00`).getTime(),
          );
        }
        if (params.categoryId) setCategoryId(Number(params.categoryId));
        else if (cats.length > 0) setCategoryId(cats[0].id);
      } else if (cats.length > 0) {
        setCategoryId(cats[0].id);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editingId, params.amount, params.categoryId, params.date, params.kind, params.note]);

  const amount = digitsToAmount(digits);
  const canSave = amount > 0 && !saving;
  const isIncome = kind === 'income';

  const today = todayISO();
  const yesterday = addDays(today, -1);
  const dateOptions = [
    { value: today, label: 'Hari ini' },
    { value: yesterday, label: 'Kemarin' },
  ];
  if (!dateOptions.some((option) => option.value === localDate)) {
    dateOptions.push({ value: localDate, label: formatDayMonth(localDate) });
  }

  function pickDate(date: ISODate) {
    setLocalDate(date);
    setOccurredAt(date === todayISO() ? nowMs() : new Date(`${date}T12:00:00`).getTime());
  }

  function handleDigit(key: string) {
    if (key === '⌫') {
      setDigits((current) => current.slice(0, -1));
      return;
    }

    setDigits((current) => {
      const next = (current + key).replace(/^0+(?=\d)/, '');
      return next.length > MAX_DIGITS ? current : next;
    });
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const cleanNote = normalizeNote(note);
      const payload = {
        kind,
        amount,
        categoryId: isIncome ? null : categoryId,
        note: cleanNote,
        localDate,
        occurredAt,
      };

      if (editingId) {
        await updateTransaction(editingId, payload);
      } else {
        await addTransaction(payload);
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={space.md}>
            <Text style={styles.cancel}>Batal</Text>
          </Pressable>
          <Text style={styles.label}>
            {editingId ? 'Ubah' : isIncome ? 'Pemasukan' : 'Pengeluaran'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={save}
            disabled={!canSave}
            hitSlop={space.md}
          >
            <Text style={[styles.save, !canSave && styles.saveDisabled]}>Simpan</Text>
          </Pressable>
        </View>

        <View style={styles.segment}>
          {(['expense', 'income'] as const).map((value) => {
            const selected = value === kind;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setKind(value)}
                style={[styles.segmentItem, selected && styles.segmentItemSelected]}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                  {value === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dateRow}>
          <Text style={styles.label}>Tanggal</Text>
          <View style={styles.dateChips}>
            {dateOptions.map((option) => {
              const selected = option.value === localDate;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => pickDate(option.value)}
                  style={[styles.dateChip, selected && styles.dateChipSelected]}
                >
                  <Text style={[styles.dateChipText, selected && styles.dateChipTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.amountBlock}>
            <Text
              style={[styles.amount, isIncome && styles.amountIncome]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {digits === '' ? 'Rp 0' : formatRp(amount)}
            </Text>
          </View>

          {isIncome ? (
            <Text style={styles.incomeHint}>
              Pemasukan menambah budget minggu ini, sisanya ikut terbawa ke minggu depan.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsRow}
              contentContainerStyle={styles.chips}
            >
              {categories.map((category) => {
                const selected = category.id === categoryId;
                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    onPress={() => setCategoryId(category.id)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={isIncome ? 'Sumber (gaji, bonus, …)' : 'Catatan (opsional)'}
            placeholderTextColor={color.ink3}
            style={styles.note}
            maxLength={120}
            returnKeyType="done"
          />
        </View>

        <MoneyPad onDigit={handleDigit} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: color.bg,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: size.touch,
  },
  label: {
    ...type.label,
    color: color.ink3,
  },
  cancel: {
    ...type.meta,
    color: color.ink2,
  },
  save: {
    ...type.meta,
    color: color.ink,
    fontWeight: '600',
  },
  saveDisabled: {
    color: color.ink3,
  },
  segment: {
    flexDirection: 'row',
    marginTop: space.md,
    padding: 2,
    borderRadius: radius.full,
    backgroundColor: color.sunken,
  },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemSelected: {
    backgroundColor: color.surface,
  },
  segmentText: {
    ...type.meta,
    color: color.ink2,
  },
  segmentTextSelected: {
    color: color.ink,
    fontWeight: '600',
  },
  dateRow: {
    marginTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateChips: {
    flexDirection: 'row',
    gap: space.sm,
  },
  dateChip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: size.hairline,
    borderColor: color.hairline,
  },
  dateChipSelected: {
    backgroundColor: color.sunken,
    borderColor: color.ink3,
  },
  dateChipText: {
    ...type.meta,
    fontSize: 13,
    color: color.ink2,
  },
  dateChipTextSelected: {
    color: color.ink,
    fontWeight: '600',
  },
  form: {
    flex: 1,
    justifyContent: 'center',
  },
  amountBlock: {
    alignItems: 'center',
  },
  amount: {
    ...type.display,
    fontSize: 40,
    lineHeight: 48,
    color: color.ink,
    textAlign: 'center',
  },
  amountIncome: {
    color: color.accent,
  },
  incomeHint: {
    ...type.meta,
    color: color.ink3,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  chipsRow: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chips: {
    gap: space.sm,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: size.hairline,
    borderColor: color.hairline,
  },
  chipSelected: {
    backgroundColor: color.ink,
    borderColor: color.ink,
  },
  chipText: {
    ...type.meta,
    color: color.ink2,
  },
  chipTextSelected: {
    color: color.bg,
  },
  note: {
    ...type.body,
    backgroundColor: color.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: size.touch,
    color: color.ink,
  },
});
