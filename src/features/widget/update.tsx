import { requestWidgetUpdate } from 'react-native-android-widget';

import { BudgetWidget } from './budget-widget';
import { BUDGET_WIDGET_NAME } from './constants';
import type { WidgetData } from './data';
import { getWidgetHidden } from './prefs';

/** Dimuat dinamis supaya Expo Go (tanpa modul native) tetap aman. */
export async function updateBudgetWidget(data: WidgetData): Promise<void> {
  const hidden = await getWidgetHidden();

  await requestWidgetUpdate({
    widgetName: BUDGET_WIDGET_NAME,
    renderWidget: (info) => ({
      light: (
        <BudgetWidget
          data={{ ...data, hidden, width: info.width, height: info.height }}
          theme="light"
        />
      ),
      dark: (
        <BudgetWidget
          data={{ ...data, hidden, width: info.width, height: info.height }}
          theme="dark"
        />
      ),
    }),
  });
}
