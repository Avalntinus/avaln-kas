import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { addTransaction, updateSettings } from '@/db/repo';
import { formatShortDate, todayISO } from '@/lib/date';
import { formatRp } from '@/lib/money';
import { useSavingsData } from '@/features/savings/use-savings-data';
import { makeThemedStyles } from '@/theme/theme';
import { radius, size, space, type, type Palette } from '@/theme/tokens';
import { AmountText } from '@/ui/amount-text';
import { Meter } from '@/ui/meter';
import { MoneyEditor } from '@/ui/money-editor';
import { Screen } from '@/ui/screen';

type Editor = 'deposit' | 'withdraw' | 'adjust' | 'target' | null;

export default function SavingsScreen() {
  const styles = useStyles();
  const {
    loading,
    balance,
    weekRemaining,
    sweepEnabled,
    savingsTarget,
    savingsOffset,
    moves,
    refresh,
  } = useSavingsData();
  const [editor, setEditor] = useState<Editor>(null);

  function openDeposit() {
    if (weekRemaining <= 0) {
      Alert.alert('Belum ada sisa', 'Sisa minggu ini belum ada yang bisa disisihkan.');
      return;
    }
    setEditor('deposit');
  }

  function openWithdraw() {
    if (balance <= 0) {
      Alert.alert('Tabungan kosong', 'Belum ada saldo yang bisa ditarik.');
      return;
    }
    setEditor('withdraw');
  }

  async function handleSave(amount: number) {
    if (editor === 'target') {
      await updateSettings({ savingsTarget: amount });
      setEditor(null);
      refresh();
      return;
    }

    if (editor === 'adjust') {
      // Saldo nyata = saldo perpindahan + offset. Simpan selisihnya sebagai offset.
      const movesBalance = balance - savingsOffset;
      await updateSettings({ savingsOffset: amount - movesBalance });
      setEditor(null);
      refresh();
      return;
    }

    const kind = editor === 'deposit' ? 'expense' : 'income';

    if (editor === 'deposit' && amount > weekRemaining) {
      Alert.alert('Melebihi sisa minggu', `Maksimal ${formatRp(weekRemaining)}.`);
      return;
    }
    if (editor === 'withdraw' && amount > balance) {
      Alert.alert('Melebihi saldo', `Saldo tabungan ${formatRp(balance)}.`);
      return;
    }

    await addTransaction({
      kind,
      amount,
      isSavings: true,
      note: editor === 'deposit' ? 'Sisihkan manual' : 'Tarik tabungan',
      localDate: todayISO(),
    });
    setEditor(null);
    refresh();
  }

  async function clearTarget() {
    await updateSettings({ savingsTarget: 0 });
    refresh();
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={space.md}>
          <Text style={styles.back}>Kembali</Text>
        </Pressable>
        <Text style={styles.label}>Tabungan</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.label, styles.heroLabel]}>Saldo tabungan</Text>
        <AmountText value={balance} variant="display" style={styles.heroAmount} />
        <Text style={styles.subline}>
          {sweepEnabled ? 'Sweep otomatis aktif tiap awal bulan.' : 'Sweep otomatis dimatikan.'}
        </Text>

        {savingsTarget > 0 ? (
          <View style={styles.target}>
            <View style={styles.targetRow}>
              <Text style={styles.label}>Target</Text>
              <Text style={styles.targetValue}>{formatRp(savingsTarget)}</Text>
            </View>
            <View style={styles.targetMeter}>
              <Meter ratio={savingsTarget > 0 ? balance / savingsTarget : 0} zone="accent" />
            </View>
            <Text style={styles.targetHint}>
              {`${Math.max(0, Math.min(100, Math.round((balance / savingsTarget) * 100)))}% tercapai`}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <Text style={styles.muted}>Memuat…</Text>
        ) : (
          <>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={openDeposit}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryLabel}>Sisihkan</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={openWithdraw}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={[styles.secondaryLabel, styles.withdrawLabel]}>Tarik</Text>
              </Pressable>
            </View>

            <Text style={styles.hint}>
              {weekRemaining > 0
                ? `Bisa disisihkan dari sisa minggu ini: ${formatRp(weekRemaining)}`
                : 'Sisa minggu ini habis, belum ada yang bisa disisihkan.'}
            </Text>

            <View style={styles.links}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditor('adjust')}
                hitSlop={space.sm}
              >
                <Text style={styles.link}>Sesuaikan saldo</Text>
              </Pressable>
              {savingsTarget > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void clearTarget()}
                  hitSlop={space.sm}
                >
                  <Text style={styles.linkMuted}>Hapus target</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEditor('target')}
                  hitSlop={space.sm}
                >
                  <Text style={styles.link}>Atur target</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.sectionHeader}>
              <Text style={styles.label}>Riwayat tabungan</Text>
              <Text style={styles.caption}>{`${moves.length} perpindahan`}</Text>
            </View>

            {moves.length === 0 ? (
              <Text style={styles.empty}>
                Belum ada perpindahan. Sisa bulan akan disapu otomatis pada awal bulan.
              </Text>
            ) : (
              moves.map((move, index) => {
                const isDeposit = move.kind === 'expense';
                const label =
                  move.note === 'Sweep tabungan'
                    ? 'Sweep otomatis'
                    : move.note === 'Sisihkan manual'
                      ? 'Sisihkan manual'
                      : move.note || (isDeposit ? 'Ke tabungan' : 'Tarik tabungan');

                return (
                  <View key={move.id} style={[styles.row, index > 0 && styles.rowBorder]}>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowLabel}>{label}</Text>
                      <Text style={styles.rowDate}>{formatShortDate(move.localDate)}</Text>
                    </View>
                    <AmountText
                      value={isDeposit ? move.amount : -move.amount}
                      variant="body"
                      signed
                      tone={isDeposit ? 'accent' : 'danger'}
                    />
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {editor ? (
        <MoneyEditor
          title={
            editor === 'deposit'
              ? 'Sisihkan ke tabungan'
              : editor === 'withdraw'
                ? 'Tarik dari tabungan'
                : editor === 'adjust'
                  ? 'Sesuaikan saldo'
                  : 'Target tabungan'
          }
          initial={editor === 'adjust' ? balance : editor === 'target' ? savingsTarget : 0}
          hint={
            editor === 'deposit'
              ? `Maksimal ${formatRp(weekRemaining)}`
              : editor === 'withdraw'
                ? `Saldo ${formatRp(balance)}`
                : editor === 'adjust'
                  ? 'Isi saldo tabungan yang sebenarnya (koreksi tidak mengubah jatah mingguan)'
                  : 'Target saldo tabungan'
          }
          onCancel={() => setEditor(null)}
          onSave={(amount) => void handleSave(amount)}
        />
      ) : null}
    </Screen>
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
    heroLabel: {
      marginTop: space.lg,
    },
    heroAmount: {
      fontSize: 44,
      lineHeight: 52,
      marginTop: space.xs,
    },
    subline: {
      ...type.meta,
      color: c.ink2,
      marginTop: space.xs,
    },
    target: {
      marginTop: space.lg,
    },
    targetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    targetValue: {
      ...type.meta,
      color: c.ink,
    },
    targetMeter: {
      marginTop: space.sm,
    },
    targetHint: {
      ...type.meta,
      fontSize: 12,
      color: c.ink3,
      marginTop: space.xs,
    },
    actions: {
      flexDirection: 'row',
      gap: space.md,
      marginTop: space.xl,
    },
    secondary: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.full,
      borderWidth: size.hairline,
      borderColor: c.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryLabel: {
      ...type.body,
      color: c.ink,
    },
    withdrawLabel: {
      color: c.danger,
    },
    pressed: {
      opacity: 0.7,
    },
    hint: {
      ...type.meta,
      color: c.ink3,
      marginTop: space.md,
    },
    links: {
      flexDirection: 'row',
      gap: space.lg,
      marginTop: space.md,
    },
    link: {
      ...type.meta,
      color: c.accent,
    },
    linkMuted: {
      ...type.meta,
      color: c.ink3,
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
    empty: {
      ...type.meta,
      color: c.ink3,
      marginTop: space.lg,
      lineHeight: 20,
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
    rowMain: {
      flexShrink: 1,
    },
    rowLabel: {
      ...type.body,
      color: c.ink,
    },
    rowDate: {
      ...type.meta,
      fontSize: 12,
      color: c.ink3,
      marginTop: 2,
    },
    muted: {
      ...type.meta,
      color: c.ink2,
      marginTop: space.lg,
    },
  }),
);
