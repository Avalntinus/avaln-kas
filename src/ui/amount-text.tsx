import { Text, type TextProps } from 'react-native';

import { formatRp, formatSignedRp } from '@/lib/money';
import { useTheme } from '@/theme/theme';
import { type } from '@/theme/tokens';

export type AmountTone = 'default' | 'muted' | 'accent' | 'warn' | 'danger';
export type AmountVariant = 'display' | 'title' | 'body' | 'meta';

export type AmountTextProps = TextProps & {
  value: number;
  variant?: AmountVariant;
  tone?: AmountTone;
  /** Tampilkan tanda + untuk nilai positif (dipakai pemasukan). */
  signed?: boolean;
};

/** Nominal rupiah dengan tabular nums supaya tidak bergeser saat angka berubah. */
export function AmountText({
  value,
  variant = 'body',
  tone = 'default',
  signed = false,
  style,
  ...rest
}: AmountTextProps) {
  const { colors } = useTheme();
  const toneColor = {
    default: colors.ink,
    muted: colors.ink2,
    accent: colors.accent,
    warn: colors.warn,
    danger: colors.danger,
  }[tone];

  return (
    <Text {...rest} style={[type[variant], { color: toneColor }, style]}>
      {signed ? formatSignedRp(value) : formatRp(value)}
    </Text>
  );
}
