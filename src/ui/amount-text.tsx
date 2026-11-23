import { Text, type TextProps } from 'react-native';

import { formatRp, formatSignedRp } from '@/lib/money';
import { color, type } from '@/theme/tokens';

export type AmountTone = 'default' | 'muted' | 'accent' | 'warn' | 'danger';
export type AmountVariant = 'display' | 'title' | 'body' | 'meta';

const TONE_COLOR: Record<AmountTone, string> = {
  default: color.ink,
  muted: color.ink2,
  accent: color.accent,
  warn: color.warn,
  danger: color.danger,
};

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
  return (
    <Text {...rest} style={[type[variant], { color: TONE_COLOR[tone] }, style]}>
      {signed ? formatSignedRp(value) : formatRp(value)}
    </Text>
  );
}
