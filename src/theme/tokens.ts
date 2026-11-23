import { StyleSheet, type TextStyle } from 'react-native';

/**
 * Satu-satunya tempat warna boleh didefinisikan.
 * Nama semantik (bukan `gray200`) supaya dark mode nanti cuma tukar nilai.
 */
export const color = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  sunken: '#F2F1ED',
  ink: '#12100E',
  ink2: '#6B6862',
  ink3: '#A8A49C',
  hairline: '#E8E6E1',
  accent: '#1F6F5C',
  warn: '#B4761A',
  danger: '#A33A32',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

export const radius = {
  md: 12,
  full: 999,
} as const;

export const size = {
  meter: 2,
  hairline: StyleSheet.hairlineWidth,
  touch: 44,
  fab: 56,
} as const;

export const type = {
  display: {
    fontSize: 48,
    fontWeight: '600',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontSize: 14,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type MeterZone = 'accent' | 'warn' | 'danger';

export function zoneColor(zone: MeterZone): string {
  return color[zone];
}
