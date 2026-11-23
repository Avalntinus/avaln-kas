import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { color, size, space, type } from '@/theme/tokens';
import { AmountText } from '@/ui/amount-text';

type DayGroup = { date: ISODate; expense: number; income: number; items: Transaction[] };
type WeekGroup = { weekStart: ISODate; expense: number; income: number; days: DayGroup[] };

const LOOKBACK_DAYS = 70;

export default function HistoryScreen() {
  const [groups, setGroups] = useState<WeekGroup[]>([]);
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
      const rows = await listTransactionsBetween(addDays(today, -LOOKBACK_DAYS), today);
      if (cancelled) return;

      const weeks = new Map<ISODate, Map<ISODate, Transaction[]>>();
      for (const row of rows) {
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
            .map(([date, items]) => ({
              date,
              expense: items
                .filter((item) => item.kind === 'expense')
                .reduce((sum, item) => sum + item.amount, 0),
              income: items
                .filter((item) => item.kind === 'income')
                .reduce((sum, item) => sum + item.amount, 0),
              items,
            }));
          return {
            weekStart,
            expense: dayGroups.reduce((sum, day) => sum + day.expense, 0),
            income: dayGroups.reduce((sum, day) => sum + day.income, 0),
            days: dayGroups,
          };
        });

      setGroups(result);
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

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={space.md}>
            <Text style={styles.back}>Kembali</Text>
          </Pressable>
          <Text style={styles.label}>Riwayat</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <Text style={styles.empty}>Memuat…</Text>
        ) : groups.length === 0 ? (
          <Text style={styles.empty}>Belum ada transaksi.</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {groups.map((week) => (
              <View key={week.weekStart}>
                <View style={styles.weekHeader}>
                  <Text style={styles.label}>
                    {`${formatDayMonth(week.weekStart)} – ${formatDayMonth(
                      addDays(week.weekStart, 6),
                    )}`}
                  </Text>
                  <View style={styles.amounts}>
                    <AmountText value={week.expense} variant="meta" tone="muted" />
                    {week.income > 0 ? (
                      <AmountText value={week.income} variant="meta" tone="accent" signed />
                    ) : null}
                  </View>
                </View>

                {week.days.map((day) => (
                  <View key={day.date}>
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayLabel}>{formatLongDate(day.date)}</Text>
                      <View style={styles.amounts}>
                        <AmountText value={day.expense} variant="meta" tone="muted" />
                        {day.income > 0 ? (
                          <AmountText value={day.income} variant="meta" tone="accent" signed />
                        ) : null}
                      </View>
                    </View>

                    {day.items.map((tx, index) => (
                      <Pressable
                        key={tx.id}
                        accessibilityRole="button"
                        onPress={() => openActions(tx)}
                        style={({ pressed }) => [
                          styles.row,
                          index > 0 && styles.rowBorder,
                          pressed && styles.rowPressed,
                        ]}
                      >
                        <Text style={styles.rowNote} numberOfLines={1}>
                          {tx.kind === 'income'
                            ? `Masuk · ${transactionLabel(tx)}`
                            : transactionLabel(tx)}
                        </Text>
                        <AmountText
                          value={tx.amount}
                          variant="body"
                          tone={tx.kind === 'income' ? 'accent' : 'default'}
                          signed={tx.kind === 'income'}
                        />
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        )}
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
    color: color.ink3,
  },
  back: {
    ...type.meta,
    color: color.ink2,
    width: 56,
  },
  empty: {
    ...type.meta,
    color: color.ink3,
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
    borderBottomColor: color.hairline,
  },
  dayHeader: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: {
    ...type.meta,
    color: color.ink2,
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
    borderTopColor: color.hairline,
  },
  rowPressed: {
    opacity: 0.5,
  },
  rowNote: {
    ...type.body,
    color: color.ink,
    flexShrink: 1,
  },
});
