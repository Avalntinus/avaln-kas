import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

const DURATION = 180;
const RISE = 6;

/**
 * Masuk layar: konten naik sedikit sambil memudar.
 *
 * Sengaja hanya opacity + translateY (native driver) supaya tetap 60fps dan
 * tidak dobel dengan animasi geser bawaan navigator. Kalau pengguna mematikan
 * animasi di Android (Reduce motion), layar langsung tampil penuh.
 */
export function useScreenEntrance() {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!active) return;
        if (reduceMotion) {
          progress.setValue(1);
          return;
        }

        Animated.timing(progress, {
          toValue: 1,
          duration: DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      })
      .catch(() => progress.setValue(1));

    return () => {
      active = false;
    };
  }, [progress]);

  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }),
      },
    ],
  };
}

/** Pembungkus isi layar yang ikut beranimasi saat halaman dibuka. */
export function ScreenBody({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const animated = useScreenEntrance();

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
