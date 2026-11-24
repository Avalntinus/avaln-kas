import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

import type { LatestRelease } from './release';

const APK_PREFIX = 'avaln-kas-';

/** Hapus APK unduhan lama supaya cache tidak menumpuk tiap kali update. */
async function clearOldApks(keepName: string): Promise<void> {
  try {
    const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory ?? '');

    await Promise.all(
      files
        .filter((name) => name.startsWith(APK_PREFIX) && name.endsWith('.apk') && name !== keepName)
        .map((name) =>
          FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${name}`, { idempotent: true }),
        ),
    );
  } catch {
    // Pembersihan cache bersifat opsional.
  }
}

/** Unduh APK lalu buka dialog installer Android (butuh izin install unknown apps). */
export async function downloadAndInstall(
  release: LatestRelease,
  onProgress: (ratio: number) => void,
): Promise<void> {
  const fileName = `${APK_PREFIX}${release.version}.apk`;
  const target = `${FileSystem.cacheDirectory}${fileName}`;

  await clearOldApks(fileName);
  await FileSystem.deleteAsync(target, { idempotent: true });

  const download = FileSystem.createDownloadResumable(release.apkUrl, target, {}, (progress) => {
    if (progress.totalBytesExpectedToWrite > 0) {
      onProgress(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
    }
  });

  const result = await download.downloadAsync();
  if (!result?.uri) throw new Error('Unduhan APK gagal.');

  const contentUri = await FileSystem.getContentUriAsync(result.uri);

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    category: 'android.intent.category.DEFAULT',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}

export async function openInstallPermission(): Promise<void> {
  await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
    data: 'package:com.avaln.kas',
  });
}
