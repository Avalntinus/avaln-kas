'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { formatRp } from '@/lib/money';

export type WidgetTheme = 'light' | 'dark';
export type WidgetState = 'loading' | 'ready' | 'error';

export interface BudgetWidgetData {
  sisaHariIni: number;
  sisaMinggu: number;
  state?: WidgetState;
}

type Hex = `#${string}`;

const PALETTE: Record<
  WidgetTheme,
  { bg: Hex; ink: Hex; ink2: Hex; ink3: Hex; accent: Hex; danger: Hex }
> = {
  light: {
    bg: '#FAFAF8',
    ink: '#12100E',
    ink2: '#6B6862',
    ink3: '#A8A49C',
    accent: '#1F6F5C',
    danger: '#A33A32',
  },
  dark: {
    bg: '#12100E',
    ink: '#F2F1ED',
    ink2: '#A8A49C',
    ink3: '#6F6A63',
    accent: '#4FA98F',
    danger: '#E07A6F',
  },
};

export function BudgetWidget({ data, theme }: { data: BudgetWidgetData; theme: WidgetTheme }) {
  const c = PALETTE[theme];
  const state = data.state ?? 'ready';
  const negative = data.sisaHariIni < 0;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: c.bg,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget
          text="SISA HARI INI"
          style={{ fontSize: 10, letterSpacing: 1.2, color: c.ink3 }}
        />

        {state === 'ready' ? (
          <FlexWidget style={{ flexDirection: 'column' }}>
            <TextWidget
              text={formatRp(data.sisaHariIni)}
              style={{
                fontSize: 30,
                fontWeight: 'bold',
                color: negative ? c.danger : c.ink,
                marginTop: 2,
                adjustsFontSizeToFit: true,
              }}
              maxLines={1}
            />
            <FlexWidget
              style={{
                width: 96,
                height: 2,
                marginTop: 8,
                backgroundColor: c.accent,
              }}
            />
          </FlexWidget>
        ) : (
          <TextWidget
            text={state === 'loading' ? 'Memuat…' : 'Buka Avaln Kas'}
            style={{ fontSize: 18, color: c.ink2, marginTop: 6 }}
            maxLines={1}
          />
        )}
      </FlexWidget>

      {state === 'ready' ? (
        <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end', marginLeft: 12 }}>
          <TextWidget text="Minggu" style={{ fontSize: 11, color: c.ink3 }} />
          <TextWidget
            text={formatRp(data.sisaMinggu)}
            style={{
              fontSize: 13,
              color: data.sisaMinggu < 0 ? c.danger : c.ink2,
              marginTop: 2,
              adjustsFontSizeToFit: true,
            }}
            maxLines={1}
          />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
