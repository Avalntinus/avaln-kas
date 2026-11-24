import { BUDGET_WIDGET_NAME } from './constants';
import { widgetSupported } from './support';

/** Minta launcher menaruh widget di home screen (Android 8+). */
export async function pinBudgetWidget(): Promise<boolean> {
  if (!widgetSupported()) return false;

  try {
    const { requestPinWidget } = await import('react-native-android-widget');
    return await requestPinWidget({ widgetName: BUDGET_WIDGET_NAME });
  } catch {
    return false;
  }
}
