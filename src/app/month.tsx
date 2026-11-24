import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { listTransactionsBetween } from '@/db/repo';
import { addMonths, formatMonthYear, monthEnd, todayISO } from '@/lib/date';
import { formatRp, formatSignedRp } from '@/lib/money';
import { summarizeMonth, type MonthSummary } from '@/logic/monthly-summary';
import { makeThemedStyles } from '@/theme/theme';
import { radius, size, space, type, type Palette } from '@/theme/tokens';
import { AmountText } from '@/ui/amount-text';
import { Meter } from '@/ui/meter';
import { Screen } from '@/ui/screen';

export default function MonthScreen() {
  const styles = useStyles();
  const [offset, setOffset] = useState(0);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [month, setMonth] = useState(addMonths(todayISO(), 0));

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        const start = addMonths(todayISO(), offset);
        const end = monthEnd(start);
        const rows = await listTransactionsBetween(start, end);
        if (cancelled) return;
        setMonth(start);
        setSummary(summarizeMonth(rows));
      })();

      return () => {
        cancelled = true;
      };
    }, [offset]),
  );

  const maxCategory = summary?.categories[0]?.amount ?? 0;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={space.md}>
          <Text style={styles.back}>Kembali</Text>
        </Pressable>
        <Text style={styles.label}>Bulanan</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.monthNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bulan sebelumnya"
            onPress={() => setOffset((value) => value - 1)}
            hitSlop={space.md}
            style={styles.navButton}
          >
            <Text style={styles.navText}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{formatMonthYear(month)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bulan berikutnya"
            onPress={() => setOffset((value) => Math.min(0, value + 1))}
            disabled={offset >= 0}
            hitSlop={space.md}
            style={styles.navButton}
          >
            <Text style={[styles.navText, offset >= 0 && styles.navDisabled]}>›</Text>
          </Pressable>
        </View>

        {!summary ? (
          <Text style={styles.muted}>Memuat…</Text>
        ) : summary.count === 0 ? (
          <Text style={styles.empty}>Belum ada transaksi di bulan ini.</Text>
        ) : (
          <>
            <Text style={[styles.label, styles.heroLabel]}>Pengeluaran</Text>
            <AmountText value={summary.expense} variant="display" style={styles.heroAmount} />
            <Text style={styles.subline}>
              {`${summary.count} transaksi · masuk ${formatRp(summary.income)}`}
            </Text>

            <View style={styles.facts}>
              <Fact label="Pemasukan" value={formatRp(summary.income)} tone="accent" />
              <Fact label="Disisihkan ke tabungan" value={formatRp(summary.savedIn)} />
              {summary.savedOut > 0 ? (
                <Fact label="Ditarik dari tabungan" value={formatRp(summary.savedOut)} />
              ) : null}
              <Fact
                label="Selisih bulan ini"
                value={formatSignedRp(summary.net)}
                tone={summary.net < 0 ? 'danger' : 'accent'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.sectionHeader}>
              <Text style={styles.label}>Per kategori</Text>
              <Text style={styles.caption}>pengeluaran</Text>
            </View>

            {summary.categories.map((category) => (
              <View key={category.name} style={styles.category}>
                <View style={styles.categoryTop}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <AmountText value={category.amount} variant="meta" />
                </View>
                <Meter
                  ratio={maxCategory > 0 ? category.amount / maxCategory : 0}
                  zone="accent"
                  height={4}
                />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Fact({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: string;
  tone?: 'muted' | 'accent' | 'danger';
}) {
  const styles = useStyles();
  return (
    <View style={styles.factRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text
        style={[
          styles.factValue,
          tone === 'accent' && styles.positive,
          tone === 'danger' && styles.negative,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((c: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: size.touch,
    },
    headerSpacer: {
      width: 56,
    },
    back: {
      ...type.meta,
      color: c.ink2,
      width: 56,
    },
    label: {
      ...type.label,
      color: c.ink3,
    },
    content: {
      paddingBottom: space.huge,
    },
    monthNav: {
      marginTop: space.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    navButton: {
      width: size.touch,
      height: size.touch,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navText: {
      ...type.title,
      color: c.ink2,
      lineHeight: 28,
    },
    navDisabled: {
      color: c.ink3,
    },
    monthLabel: {
      ...type.body,
      color: c.ink,
    },
    heroLabel: {
      marginTop: space.lg,
    },
    heroAmount: {
      fontSize: 40,
      lineHeight: 46,
      marginTop: space.xs,
    },
    subline: {
      ...type.meta,
      color: c.ink2,
      marginTop: space.xs,
    },
    facts: {
      marginTop: space.lg,
      gap: 2,
    },
    factRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    factValue: {
      ...type.meta,
      color: c.ink,
    },
    positive: {
      color: c.accent,
    },
    negative: {
      color: c.danger,
    },
    divider: {
      height: size.hairline,
      backgroundColor: c.hairline,
      marginTop: space.xl,
    },
    sectionHeader: {
      marginTop: space.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    caption: {
      ...type.meta,
      fontSize: 12,
      color: c.ink3,
    },
    category: {
      marginTop: space.lg,
    },
    categoryTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: space.xs,
    },
    categoryName: {
      ...type.body,
      color: c.ink,
    },
    muted: {
      ...type.meta,
      color: c.ink2,
      marginTop: space.lg,
    },
    empty: {
      ...type.meta,
      color: c.ink3,
      marginTop: space.xl,
    },
  }),
);
