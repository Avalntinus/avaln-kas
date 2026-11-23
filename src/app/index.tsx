import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHomeData } from '@/features/home/use-home-data';
import { formatLongDate } from '@/lib/date';
import { transactionLabel } from '@/lib/labels';
import { formatRp, formatSignedRp } from '@/lib/money';
import { meterZone } from '@/logic/rollover';
import { color, radius, size, space, type } from '@/theme/tokens';
import { AmountText } from '@/ui/amount-text';
import { Meter } from '@/ui/meter';
import { Screen } from '@/ui/screen';

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { loading, error, home, today, transactions, needsSetup } = useHomeData();

  // Angka 48pt aman di tablet, tetapi di HP 360dp perlu diturunkan agar tidak terpotong.
  const displaySize = width < 380 ? 40 : 48;

  if (loading) {
    return (
      <Screen>
        <Text style={styles.muted}>Memuat…</Text>
      </Screen>
    );
  }

  if (needsSetup) return <Redirect href="/welcome" />;

  if (error || !home) {
    return (
      <Screen>
        <Text style={styles.error}>{error ?? 'Gagal memuat data'}</Text>
      </Screen>
    );
  }

  const day = home.today;
  const sisaHariIni = day?.carryOut ?? 0;
  const dayRatio = day && day.available > 0 ? day.spent / day.available : 1;
  const dayZone = meterZone(dayRatio);
  const sisaTone =
    sisaHariIni < 0
      ? 'danger'
      : day && day.available > 0 && sisaHariIni / day.available < 0.25
        ? 'warn'
        : 'default';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topRow}>
          <Text style={styles.date}>{formatLongDate(today)}</Text>
          <View style={styles.links}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/history')}
              hitSlop={space.sm}
            >
              <Text style={styles.link}>Riwayat</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/settings')}
              hitSlop={space.sm}
            >
              <Text style={styles.link}>Setelan</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.label}>Sisa hari ini</Text>
          <AmountText
            value={sisaHariIni}
            variant="display"
            tone={sisaTone}
            style={[styles.heroAmount, { fontSize: displaySize, lineHeight: displaySize * 1.15 }]}
          />
          <Text style={styles.subline}>
            {`dari ${formatRp(day?.base ?? 0)}`}
            {day && day.carryIn !== 0 ? ` · rollover ${formatSignedRp(day.carryIn)}` : ''}
          </Text>
        </View>

        <View style={styles.meterWrap}>
          <Meter ratio={dayRatio} zone={dayZone} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lihat rincian minggu"
          onPress={() => router.push('/week')}
          style={({ pressed }) => [styles.weekRow, pressed && styles.pressed]}
        >
          <Text style={styles.muted}>Sisa minggu ini</Text>
          <View style={styles.weekValue}>
            <AmountText
              value={home.remainingWeek}
              variant="meta"
              tone={home.remainingWeek < 0 ? 'danger' : 'muted'}
            />
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>

        {home.week.income > 0 ? (
          <View style={styles.weekRow}>
            <Text style={styles.muted}>Pemasukan minggu ini</Text>
            <AmountText value={home.week.income} variant="meta" tone="accent" signed />
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.listHeader}>
          <Text style={styles.label}>Hari ini</Text>
          <Text style={styles.caption}>
            {`${transactions.length} transaksi · keluar ${formatRp(home.spentToday)}`}
          </Text>
        </View>

        {transactions.length === 0 ? (
          <Text style={styles.empty}>Belum ada catatan hari ini.</Text>
        ) : (
          <View>
            {transactions.map((tx, index) => (
              <Pressable
                key={tx.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/add',
                    params: { id: String(tx.id) },
                  })
                }
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && styles.rowBorder,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.rowNote} numberOfLines={1}>
                  {tx.kind === 'income' ? `Masuk · ${transactionLabel(tx)}` : transactionLabel(tx)}
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
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tambah pengeluaran"
        onPress={() => router.push('/add')}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + space.xl },
          pressed && styles.fabPressed,
        ]}
      >
        <Text style={styles.fabLabel}>+</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: size.fab + space.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  date: {
    ...type.meta,
    color: color.ink3,
    flexShrink: 1,
  },
  links: {
    flexDirection: 'row',
    gap: space.lg,
  },
  link: {
    ...type.meta,
    color: color.ink2,
  },
  label: {
    ...type.label,
    color: color.ink3,
  },
  hero: {
    marginTop: space.xxl,
  },
  heroAmount: {
    marginTop: space.sm,
  },
  subline: {
    ...type.meta,
    color: color.ink2,
    marginTop: space.sm,
  },
  meterWrap: {
    marginTop: space.xl,
  },
  weekRow: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  chevron: {
    ...type.meta,
    color: color.ink3,
    marginTop: -2,
  },
  muted: {
    ...type.meta,
    color: color.ink2,
  },
  caption: {
    ...type.meta,
    color: color.ink3,
  },
  divider: {
    height: size.hairline,
    backgroundColor: color.hairline,
    marginTop: space.lg,
  },
  listHeader: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  empty: {
    ...type.meta,
    color: color.ink3,
    marginTop: space.lg,
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
  pressed: {
    opacity: 0.5,
  },
  rowNote: {
    ...type.body,
    color: color.ink,
    flexShrink: 1,
  },
  error: {
    ...type.body,
    color: color.danger,
  },
  fab: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xl,
    width: size.fab,
    height: size.fab,
    borderRadius: radius.full,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPressed: {
    opacity: 0.7,
  },
  fabLabel: {
    color: color.bg,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '300',
  },
});
