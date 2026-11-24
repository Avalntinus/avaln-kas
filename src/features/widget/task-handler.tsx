import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { BudgetWidget } from './budget-widget';
import { BUDGET_WIDGET_NAME } from './constants';
import { loadWidgetData } from './data';

function render(
  props: WidgetTaskHandlerProps,
  data: { sisaHariIni: number; sisaMinggu: number },
  state: 'loading' | 'ready' | 'error',
) {
  const payload = { ...data, state };
  props.renderWidget({
    light: <BudgetWidget data={payload} theme="light" />,
    dark: <BudgetWidget data={payload} theme="dark" />,
  });
}

/**
 * Dipanggil Android saat widget ditambah, di-resize, atau di-refresh berkala.
 * Saat WIDGET_ADDED, render placeholder dulu supaya widget tidak kosong.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== BUDGET_WIDGET_NAME) return;
  if (props.widgetAction === 'WIDGET_DELETED') return;

  const empty = { sisaHariIni: 0, sisaMinggu: 0 };

  if (props.widgetAction === 'WIDGET_ADDED') {
    render(props, empty, 'loading');
  }

  try {
    const data = await loadWidgetData();
    render(props, data, 'ready');
  } catch {
    render(props, empty, 'error');
  }
}
