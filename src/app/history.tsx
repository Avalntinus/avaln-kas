import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deleteTransaction,
  getSettings,
  listTransactionsBetween,
  type Transaction,
} from '@/db/repo';
import {
  addDays,
  formatDayMonth,
  formatLongDate,
  startOfWeek,
  todayISO,
  type ISODate,
} from '@/lib/date';
import { transactionLabel } from '@/lib/labels';
import { formatRp } from '@/lib/money';
import { makeThemedStyles } from '@/theme/theme';
import { size, space, type, type Palette } from '@/theme/tokens';
import { AmountText } from '@/ui/amount-text';
import { ScreenBody } from '@/ui/motion';

type DayGroup = { date: ISODate; expense: number; income: number; items: Transaction[] };
type WeekGroup = { weekStart: ISODate; expense: number; income: number; days: DayGroup[] };

/** Baris datar supaya daftar bisa virtual: 70 hari riwayat tidak dirender sekaligus. */
type Row =
  | { type: 'week'; key: string; weekStart: ISODate; expense: number; income: number }
  | { type: 'day'; key: string; date: ISODate; expense: number; income: number }
  | { type: 'tx'; key: string; tx: Transaction; divider: boolean };

const LOOKBACK_DAYS = 70;

function flatten(weeks: WeekGroup[]): Row[] {
  const rows: Row[] = [];

  for (const week of weeks) {
    rows.push({
      type: 'week',
      key: `w:${week.weekStart}`,
      weekStart: week.weekStart,
      expense: week.expense,
      income: week.income,
    });

    for (const day of week.days) {
      rows.push({
        type: 'day',
        key: `d:${day.date}`,
        date: day.date,
        expense: day.expense,
        income: day.income,
      });

      day.items.forEach((tx, index) => {
        rows.push({ type: 'tx', key: `t:${tx.id}`, tx, divider: index > 0 });
      });
    }
  }

  return rows;
}

export default function HistoryScreen() {
  const styles = useStyles();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((value) => value + 1);
    }, []),
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const settings = await getSettings();
      const today = todayISO();
      const items = await listTransactionsBetween(addDays(today, -LOOKBACK_DAYS), today);
      if (cancelled) return;

      const weeks = new Map<ISODate, Map<ISODate, Transaction[]>>();
      for (const row of items) {
        const weekStart = startOfWeek(row.localDate, settings.weekStart);
        if (!weeks.has(weekStart)) weeks.set(weekStart, new Map());
        const days = weeks.get(weekStart)!;
        if (!days.has(row.localDate)) days.set(row.localDate, []);
        days.get(row.localDate)!.push(row);
      }

      const result: WeekGroup[] = [...weeks.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([weekStart, days]) => {
          const dayGroups: DayGroup[] = [...days.entries()]
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .map(([date, dayItems]) => ({
              date,
              expense: dayItems
                .filter((item) => item.kind === 'expense' && !item.isSavings)
                .reduce((sum, item) => sum + item.amount, 0),
              income: dayItems
                .filter((item) => item.kind === 'income' && !item.isSavings)
                .reduce((sum, item) => sum + item.amount, 0),
              items: dayItems,
            }));
          return {
            weekStart,
            expense: dayGroups.reduce((sum, day) => sum + day.expense, 0),
            income: dayGroups.reduce((sum, day) => sum + day.income, 0),
            days: dayGroups,
          };
        });

      setRows(flatten(result));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  function openActions(tx: Transaction) {
    Alert.alert(formatRp(tx.amount), transactionLabel(tx), [
      {
        text: 'Ubah',
        onPress: () => router.push({ pathname: '/add', params: { id: String(tx.id) } }),
      },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(tx.id);
          setTick((value) => value + 1);
        },
      },
      { text: 'Batal', style: 'cancel' },
    ]);
  }

  function renderRow({ item }: { item: Row }) {
    if (item.type === 'week') {
      return (
        <View style={styles.weekHeader}>
          <Text style={styles.label}>
            {`${formatDayMonth(item.weekStart)} – ${formatDayMonth(addDays(item.weekStart, 6))}`}
          </Text>
          <View style={styles.amounts}>
            <AmountText value={item.expense} variant="meta" tone="muted" />
            {item.income > 0 ? (
              <AmountText value={item.income} variant="meta" tone="accent" signed />
            ) : null}
          </View>
        </View>
      );
    }

    if (item.type === 'day') {
      return (
        <View style={styles.dayHeader}>
          <Text style={styles.dayLabel}>{formatLongDate(item.date)}</Text>
          <View style={styles.amounts}>
            <AmountText value={item.expense} variant="meta" tone="muted" />
            {item.income > 0 ? (
              <AmountText value={item.income} variant="meta" tone="accent" signed />
            ) : null}
          </View>
        </View>
      );
    }

    const { tx } = item;

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => openActions(tx)}
        style={({ pressed }) => [
          styles.row,
          item.divider && styles.rowBorder,
          pressed && styles.rowPressed,
        ]}
      >
        <Text style={styles.rowNote} numberOfLines={1}>
          {tx.kind === 'income' ? `Masuk · ${transactionLabel(tx)}` : transactionLabel(tx)}
        </Text>
        <AmountText
          value={tx.amount}
          variant="body"
          tone={
            tx.isSavings
              ? tx.kind === 'income'
                ? 'accent'
                : 'muted'
              : tx.kind === 'income'
                ? 'accent'
                : 'default'
          }
          signed={tx.kind === 'income'}
        />
      </Pressable>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScreenBody style={styles.container}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={space.md}>
            <Text style={styles.back}>Kembali</Text>
          </Pressable>
          <Text style={styles.label}>Riwayat</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <Text style={styles.empty}>Memuat…</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>Belum ada transaksi.</Text>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.key}
            renderItem={renderRow}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            initialNumToRender={18}
            maxToRenderPerBatch={12}
            windowSize={9}
            removeClippedSubviews
          />
        )}
      </ScreenBody>
    </SafeAreaView>
  );
}

const useStyles = makeThemedStyles((c: Palette) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.bg,
    },
    container: {
      flex: 1,
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
      paddingHorizontal: space.xl,
      paddingTop: space.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: size.touch,
    },
    headerSpacer: {
      width: 56,
    },
    label: {
      ...type.label,
      color: c.ink3,
    },
    back: {
      ...type.meta,
      color: c.ink2,
      width: 56,
    },
    empty: {
      ...type.meta,
      color: c.ink3,
      marginTop: space.xxl,
    },
    list: {
      paddingBottom: space.huge,
    },
    weekHeader: {
      marginTop: space.xxl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: space.sm,
      borderBottomWidth: size.hairline,
      borderBottomColor: c.hairline,
    },
    dayHeader: {
      marginTop: space.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dayLabel: {
      ...type.meta,
      color: c.ink2,
    },
    amounts: {
      flexDirection: 'row',
      gap: space.md,
    },
    row: {
      minHeight: size.touch,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.lg,
    },
    rowBorder: {
      borderTopWidth: size.hairline,
      borderTopColor: c.hairline,
    },
    rowPressed: {
      opacity: 0.5,
    },
    rowNote: {
      ...type.body,
      color: c.ink,
      flexShrink: 1,
    },
  }),
);
