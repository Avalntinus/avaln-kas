import { View } from 'react-native';

import { color, size, zoneColor, type MeterZone } from '@/theme/tokens';

export type MeterProps = {
  /** 0..1 (di-clamp) */
  ratio: number;
  zone: MeterZone;
  height?: number;
};

/**
 * Bar 2px. Referensi: 21st.dev/redrob-labs/meter (id 38114).
 * Diadaptasi: tanpa gradient, tanpa label di dalam bar, ambang tetap 75% / 90%.
 */
export function Meter({ ratio, zone, height = size.meter }: MeterProps) {
  const safe = Number.isFinite(ratio) ? ratio : 1;
  const percent = Math.max(0, Math.min(1, safe)) * 100;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: color.hairline,
        overflow: 'hidden',
      }}
    >
      <View style={{ height, width: `${percent}%`, backgroundColor: zoneColor(zone) }} />
    </View>
  );
}
