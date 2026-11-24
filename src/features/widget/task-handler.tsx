import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { BudgetWidget } from './budget-widget';
import { BUDGET_WIDGET_NAME } from './constants';
import { loadWidgetData, type WidgetData } from './data';
import { getWidgetHidden, setWidgetHidden } from './prefs';

const EMPTY: WidgetData = { sisaHariIni: 0, sisaMinggu: 0 };

function render(
  props: WidgetTaskHandlerProps,
  data: WidgetData,
  state: 'loading' | 'ready' | 'error',
  hidden: boolean,
) {
  const { width, height } = props.widgetInfo;
  const payload = { ...data, state, hidden, width, height };

  props.renderWidget({
    light: <BudgetWidget data={payload} theme="light" />,
    dark: <BudgetWidget data={payload} theme="dark" />,
  });
}

/**
 * Dipanggil Android saat widget ditambah, di-resize, di-refresh berkala,
 * atau saat tombol "Tutup/Lihat" ditekan.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== BUDGET_WIDGET_NAME) return;
  if (props.widgetAction === 'WIDGET_DELETED') return;

  let hidden = await getWidgetHidden();

  if (props.widgetAction === 'WIDGET_CLICK') {
    if (props.clickAction !== 'TOGGLE_HIDDEN') return;
    hidden = !hidden;
    await setWidgetHidden(hidden);
  }

  if (props.widgetAction === 'WIDGET_ADDED') {
    render(props, EMPTY, 'loading', hidden);
  }

  try {
    const data = await loadWidgetData();
    render(props, data, 'ready', hidden);
  } catch {
    render(props, EMPTY, 'error', hidden);
  }
}
