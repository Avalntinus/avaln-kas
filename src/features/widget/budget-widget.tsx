'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { formatRp } from '@/lib/money';

export type WidgetTheme = 'light' | 'dark';
export type WidgetState = 'loading' | 'ready' | 'error';

export interface BudgetWidgetData {
  sisaHariIni: number;
  sisaMinggu: number;
  state?: WidgetState;
  hidden?: boolean;
  width?: number;
  height?: number;
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
    bg: '#0A0A0A',
    ink: '#F5F5F5',
    ink2: '#A6A6A6',
    ink3: '#707070',
    accent: '#4FA98F',
    danger: '#E57373',
  },
};

const MASK = 'Rp ••••••';

export function BudgetWidget({ data, theme }: { data: BudgetWidgetData; theme: WidgetTheme }) {
  const c = PALETTE[theme];
  const state = data.state ?? 'ready';
  const hidden = data.hidden ?? false;
  const compact = (data.height ?? 200) < 110;
  const narrow = (data.width ?? 250) < 200;
  const amountSize = narrow ? 22 : 30;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Avaln Kas, ketuk untuk membuka"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: c.bg,
        borderRadius: 24,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: 'match_parent',
        }}
      >
        <TextWidget
          text="SISA HARI INI"
          style={{ fontSize: compact ? 9 : 10, letterSpacing: 1.1, color: c.ink3 }}
        />
        {state === 'ready' ? (
          <TextWidget
            text={hidden ? 'Lihat' : 'Tutup'}
            clickAction="TOGGLE_HIDDEN"
            accessibilityLabel={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
            style={{ fontSize: 10, color: c.accent }}
          />
        ) : null}
      </FlexWidget>

      <FlexWidget style={{ flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
        {state === 'ready' ? (
          <TextWidget
            text={hidden ? MASK : formatRp(data.sisaHariIni)}
            style={{
              fontSize: amountSize,
              fontWeight: 'bold',
              color: !hidden && data.sisaHariIni < 0 ? c.danger : c.ink,
              marginTop: 2,
            }}
            maxLines={1}
          />
        ) : (
          <TextWidget
            text={state === 'loading' ? 'Memuat…' : 'Buka Avaln Kas'}
            style={{ fontSize: 16, color: c.ink2, marginTop: 4 }}
            maxLines={1}
          />
        )}

        {state === 'ready' ? (
          <FlexWidget style={{ width: 72, height: 2, marginTop: 8, backgroundColor: c.accent }} />
        ) : null}
      </FlexWidget>

      {state === 'ready' && !compact ? (
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: 'match_parent',
          }}
        >
          <TextWidget text="Minggu" style={{ fontSize: 11, color: c.ink3 }} />
          <TextWidget
            text={hidden ? '••••••' : formatRp(data.sisaMinggu)}
            style={{
              fontSize: 12,
              color: !hidden && data.sisaMinggu < 0 ? c.danger : c.ink2,
            }}
            maxLines={1}
          />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
