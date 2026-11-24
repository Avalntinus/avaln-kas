import { Platform } from 'react-native';

import 'expo-router/entry';

import { widgetSupported } from './features/widget/support';

if (Platform.OS === 'android' && widgetSupported()) {
  // Registrasi harus SINKRON: event widget bisa datang sebelum microtask
  // dynamic import selesai. Di Expo Go blok ini tidak dijalankan, jadi modul
  // native yang tidak ada tidak pernah dimuat.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./features/widget/register');
}
