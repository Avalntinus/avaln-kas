import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'gemini_api_key';

/** API key disimpan di Android Keystore lewat expo-secure-store, bukan AsyncStorage. */
export async function getAiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_NAME);
  } catch {
    return null;
  }
}

export async function setAiKey(value: string): Promise<void> {
  const clean = value.trim();
  if (clean === '') throw new Error('API key kosong');
  await SecureStore.setItemAsync(KEY_NAME, clean, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

export async function clearAiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_NAME);
}
