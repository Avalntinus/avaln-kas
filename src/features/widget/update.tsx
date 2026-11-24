import { requestWidgetUpdate } from 'react-native-android-widget';

import { BudgetWidget } from './budget-widget';
import { BUDGET_WIDGET_NAME } from './constants';
import type { WidgetData } from './data';

/** Dimuat dinamis supaya Expo Go (tanpa modul native) tetap aman. */
export async function updateBudgetWidget(data: WidgetData): Promise<void> {
  await requestWidgetUpdate({
    widgetName: BUDGET_WIDGET_NAME,
    renderWidget: () => ({
      light: <BudgetWidget data={data} theme="light" />,
      dark: <BudgetWidget data={data} theme="dark" />,
    }),
  });
}
