import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { digitsToAmount, formatRp } from '@/lib/money';
import { color, radius, size, space, type } from '@/theme/tokens';
import { MoneyPad } from '@/ui/money-pad';

const MAX_DIGITS = 10;

export type MoneyEditorProps = {
  title: string;
  /** Nilai awal (selalu positif; tanda diatur lewat `negative`). */
  initial: number;
  /** Simpan sebagai minus (dipakai untuk debt floor). */
  negative?: boolean;
  hint?: string;
  onCancel: () => void;
  onSave: (amount: number) => void;
};

/**
 * Editor nominal berbasis MoneyPad. Dipakai Settings supaya input uang
 * selalu lewat jalur yang sama dengan layar Tambah (tanpa keyboard sistem).
 */
export function MoneyEditor({
  title,
  initial,
  negative = false,
  hint,
  onCancel,
  onSave,
}: MoneyEditorProps) {
  // Modal dipasang hanya saat dibuka (lihat Settings), jadi nilai awal cukup once.
  const [digits, setDigits] = useState(() =>
    initial > 0 ? String(Math.round(Math.abs(initial))) : '',
  );

  const amount = digitsToAmount(digits);

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

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <SafeAreaView edges={['bottom']} style={styles.panel}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={space.md}>
              <Text style={styles.cancel}>Batal</Text>
            </Pressable>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={space.md}
              disabled={amount <= 0}
              onPress={() => onSave(negative ? -amount : amount)}
            >
              <Text style={[styles.save, amount <= 0 && styles.saveDisabled]}>Simpan</Text>
            </Pressable>
          </View>

          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            {amount <= 0 ? 'Rp 0' : `${negative ? '−' : ''}${formatRp(amount)}`}
          </Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}

          <MoneyPad onDigit={handleDigit} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(18, 16, 14, 0.28)',
  },
  panel: {
    backgroundColor: color.bg,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: size.touch,
  },
  title: {
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
  amount: {
    ...type.display,
    fontSize: 36,
    lineHeight: 44,
    color: color.ink,
    textAlign: 'center',
    marginTop: space.lg,
  },
  hint: {
    ...type.meta,
    color: color.ink3,
    textAlign: 'center',
    marginTop: space.sm,
    marginBottom: space.lg,
  },
});
