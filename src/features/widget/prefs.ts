import Storage from 'expo-sqlite/kv-store';

const KEY = 'widget_hidden';

/** Preferensi sembunyikan saldo di widget, dipakai juga di konteks headless. */
export async function getWidgetHidden(): Promise<boolean> {
  try {
    return (await Storage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setWidgetHidden(hidden: boolean): Promise<void> {
  try {
    await Storage.setItem(KEY, hidden ? '1' : '0');
  } catch {
    // Preferensi gagal disimpan: widget tetap merender state saat ini.
  }
}
