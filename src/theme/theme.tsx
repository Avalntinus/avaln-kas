import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { NavigationBar } from 'expo-navigation-bar';
import { Platform, useColorScheme, View } from 'react-native';

import { getSettings, updateSettings } from '@/db/repo';
import {
  darkColors,
  lightColors,
  resolveTheme,
  type Palette,
  type ResolvedTheme,
  type ThemeMode,
} from './tokens';

interface ThemeContextValue {
  colors: Palette;
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const saved = await getSettings();
        if (!cancelled) setModeState(saved.themeMode);
      } catch {
        // Biarkan default 'system' kalau database belum siap.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = resolveTheme(mode, system);
  const colors = resolved === 'dark' ? darkColors : lightColors;

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void updateSettings({ themeMode: next }).catch(() => {
      // Preferensi tetap berlaku di sesi ini walau gagal disimpan.
    });
  }, []);

  const value = useMemo(
    () => ({ colors, mode, resolved, setMode }),
    [colors, mode, resolved, setMode],
  );

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <ThemeContext.Provider value={value}>
      {Platform.OS === 'android' ? (
        <NavigationBar style={resolved === 'dark' ? 'dark' : 'light'} />
      ) : null}
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme harus dipakai di dalam ThemeProvider');
  return value;
}

/**
 * Stylesheet per tema, dibuat sekali saat modul dimuat.
 * Pemakaian: `const useStyles = makeThemedStyles((c) => StyleSheet.create({...}))`
 */
export function makeThemedStyles<T>(factory: (colors: Palette) => T): () => T {
  const light = factory(lightColors);
  const dark = factory(darkColors);

  return function useThemedStyles(): T {
    const { resolved } = useTheme();
    return resolved === 'dark' ? dark : light;
  };
}
