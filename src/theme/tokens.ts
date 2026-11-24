import { StyleSheet, type TextStyle } from 'react-native';

/**
 * Dua palet dengan nama peran yang sama. Komponen tidak boleh memakai hex
 * langsung; selalu lewat `useTheme().colors`.
 */
export interface Palette {
  bg: string;
  surface: string;
  sunken: string;
  ink: string;
  ink2: string;
  ink3: string;
  hairline: string;
  accent: string;
  warn: string;
  danger: string;
}

export const lightColors: Palette = {
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
};

export const darkColors: Palette = {
  bg: '#12100E',
  surface: '#1A1816',
  sunken: '#23201D',
  ink: '#F2F1ED',
  ink2: '#A8A49C',
  ink3: '#6F6A63',
  hairline: '#2E2A26',
  accent: '#4FA98F',
  warn: '#D9A441',
  danger: '#E07A6F',
};

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

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

export function zoneColor(zone: MeterZone, colors: Palette): string {
  return colors[zone];
}

/** Mode tersimpan + preferensi sistem -> tema yang benar-benar dipakai. */
export function resolveTheme(
  mode: ThemeMode,
  system: 'light' | 'dark' | null | undefined,
): ResolvedTheme {
  if (mode === 'system') return system === 'dark' ? 'dark' : 'light';
  return mode;
}
