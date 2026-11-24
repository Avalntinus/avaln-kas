import { Platform } from 'react-native';

import { loadWidgetData } from './data';
import { widgetSupported } from './support';

/**
 * Widget hanya ada di build native. Semua impor ke react-native-android-widget
 * dilakukan dinamis supaya Expo Go tidak pernah memuat modul yang tidak ada.
 */
export async function refreshBudgetWidget(): Promise<void> {
  if (Platform.OS !== 'android' || !widgetSupported()) return;

  try {
    const data = await loadWidgetData();
    const { updateBudgetWidget } = await import('./update');
    await updateBudgetWidget(data);
  } catch {
    // Widget opsional: kegagalan refresh tidak boleh mengganggu app.
  }
}
