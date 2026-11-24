import { Pressable, StyleSheet, Text, View } from 'react-native';

import { makeThemedStyles } from '@/theme/theme';
import { radius, size, type, type Palette } from '@/theme/tokens';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'] as const;

export type MoneyPadProps = {
  onDigit: (key: string) => void;
};

/**
 * Keypad IDR: tanpa sen, tanpa desimal, tanpa shadow.
 * Referensi: 21st.dev/bankkroll/number-pad (id 3711). Versi ini membuang
 * pembagian 100 dan memakai grid hairline sesuai arah minimalis.
 */
export function MoneyPad({ onDigit }: MoneyPadProps) {
  const styles = useStyles();

  return (
    <View style={styles.grid}>
      {KEYS.map((key, index) => {
        const column = index % 3;
        const isLastRow = index >= 9;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === '⌫' ? 'Hapus' : key === '000' ? 'nol nol nol' : key}
            onPress={() => onDigit(key)}
            style={({ pressed }) => [
              styles.key,
              column < 2 && styles.keyRightBorder,
              !isLastRow && styles.keyBottomBorder,
              pressed && styles.keyPressed,
            ]}
          >
            <Text style={styles.keyLabel}>{key}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeThemedStyles((c: Palette) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    key: {
      width: '33.3333%',
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
    },
    keyRightBorder: {
      borderRightWidth: size.hairline,
      borderRightColor: c.hairline,
    },
    keyBottomBorder: {
      borderBottomWidth: size.hairline,
      borderBottomColor: c.hairline,
    },
    keyPressed: {
      backgroundColor: c.sunken,
    },
    keyLabel: {
      ...type.title,
      color: c.ink,
      fontWeight: '400',
    },
  }),
);
