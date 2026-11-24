import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/**
 * Lebar konten maksimum. Di tablet, teks selebar 1600px sulit dibaca;
 * dibatasi dan ditengahkan supaya terlihat seperti kolom yang disengaja.
 */
export const CONTENT_MAX_WIDTH = 520;

export type ScreenProps = {
  children: ReactNode;
};

export function Screen({ children }: ScreenProps) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const horizontal = width < 360 ? space.lg : space.xl;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: CONTENT_MAX_WIDTH,
          alignSelf: 'center',
          paddingHorizontal: horizontal,
          paddingTop: space.xl,
        }}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
