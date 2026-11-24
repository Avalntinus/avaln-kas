import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

/**
 * Widget hanya tersedia kalau modul native `AndroidWidget` ikut dibangun.
 * Expo Go tidak memilikinya, jadi cek modulnya langsung (bukan lewat
 * Constants.executionEnvironment yang tidak akurat di SDK 58).
 */
export function widgetSupported(): boolean {
  if (Platform.OS !== 'android') return false;

  try {
    if ((NativeModules as Record<string, unknown>).AndroidWidget) return true;
    return TurboModuleRegistry.get('AndroidWidget') != null;
  } catch {
    return false;
  }
}
