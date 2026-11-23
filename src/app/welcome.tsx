import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { completeOnboarding } from '@/db/repo';
import { digitsToAmount, formatRp } from '@/lib/money';
import { color, radius, size, space, type } from '@/theme/tokens';
import { MoneyPad } from '@/ui/money-pad';

const MAX_DIGITS = 10;

const WEEKDAYS = [
  { value: 1, label: 'Senin' },
  { value: 0, label: 'Minggu' },
] as const;

/**
 * Layar pertama: budget mingguan + awal minggu.
 * Tanpa ini, angka di Home hanya seed bawaan dan terasa asing.
 */
export default function WelcomeScreen() {
  const [digits, setDigits] = useState('210000');
  const [weekStart, setWeekStart] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  const amount = digitsToAmount(digits);
  const perDay = Math.floor(amount / 7 / 500) * 500;
  const canStart = amount > 0 && !saving;

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

  async function start() {
    if (!canStart) return;
    setSaving(true);
    try {
      await completeOnboarding({ weeklyBudget: amount, weekStart });
      router.replace('/');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>Avaln Kas</Text>

        <Text style={styles.title}>Berapa budget mingguanmu?</Text>
        <Text style={styles.body}>
          Sisa tiap hari otomatis terbawa ke besok, sisa minggu terbawa ke minggu depan. Kalau
          minus, tetap terbawa — dengan batas bawah supaya tidak spiral.
        </Text>

        <View style={styles.amountBlock}>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            {amount > 0 ? formatRp(amount) : 'Rp 0'}
          </Text>
          <Text style={styles.hint}>
            {amount === 0
              ? 'Masukkan nominal budget'
              : perDay > 0
                ? `Sekitar ${formatRp(perDay)} per hari`
                : 'Terlalu kecil untuk dibagi 7 hari'}
          </Text>
        </View>

        <View style={styles.weekRow}>
          <Text style={styles.label}>Mulai minggu</Text>
          <View style={styles.chips}>
            {WEEKDAYS.map((day) => {
              const selected = day.value === weekStart;
              return (
                <Pressable
                  key={day.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setWeekStart(day.value)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={start}
          disabled={!canStart}
          style={({ pressed }) => [
            styles.start,
            !canStart && styles.startDisabled,
            pressed && styles.startPressed,
          ]}
        >
          <Text style={styles.startLabel}>{saving ? 'Menyimpan…' : 'Mulai'}</Text>
        </Pressable>

        <Text style={styles.footnote}>Bisa diubah kapan saja di Setelan.</Text>

        <View style={styles.spacer} />

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
    paddingTop: space.xl,
    paddingBottom: space.md,
  },
  brand: {
    ...type.label,
    color: color.accent,
  },
  title: {
    ...type.title,
    color: color.ink,
    marginTop: space.lg,
  },
  body: {
    ...type.meta,
    color: color.ink2,
    marginTop: space.sm,
    lineHeight: 21,
  },
  amountBlock: {
    marginTop: space.xl,
    alignItems: 'center',
  },
  amount: {
    ...type.display,
    fontSize: 40,
    lineHeight: 48,
    color: color.ink,
    textAlign: 'center',
  },
  hint: {
    ...type.meta,
    color: color.ink3,
    marginTop: space.xs,
  },
  weekRow: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...type.label,
    color: color.ink3,
  },
  chips: {
    flexDirection: 'row',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.lg,
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
  start: {
    marginTop: space.lg,
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startDisabled: {
    backgroundColor: color.hairline,
  },
  startPressed: {
    opacity: 0.8,
  },
  startLabel: {
    ...type.body,
    color: color.bg,
    fontWeight: '600',
  },
  footnote: {
    ...type.meta,
    fontSize: 12,
    color: color.ink3,
    textAlign: 'center',
    marginTop: space.sm,
  },
  spacer: {
    flex: 1,
    minHeight: space.md,
  },
});
