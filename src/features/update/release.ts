import * as Device from 'expo-device';

export interface LatestRelease {
  tag: string;
  version: string;
  notes: string;
  apkUrl: string;
  size: number;
}

interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
  size?: number;
}

const REPO = 'Avalntinus/avaln-kas';

function cleanVersion(value: string): string {
  return value.replace(/^v/i, '').trim();
}

/**
 * Rilis memuat dua APK: arm64 (HP/tablet) dan x86_64 (emulator).
 * Ambil yang cocok; kalau tidak ada, pakai APK universal tanpa akhiran arsitektur.
 */
function pickApk(assets: ReleaseAsset[]): ReleaseAsset | undefined {
  const apks = assets.filter((item) => item.name?.endsWith('.apk') && item.browser_download_url);
  const needle = Device.isDevice ? 'arm64' : 'x86_64';

  return (
    apks.find((item) => item.name?.includes(needle)) ??
    apks.find((item) => !/-(arm|x86)/i.test(item.name ?? '')) ??
    apks[0]
  );
}

export async function fetchLatestRelease(): Promise<LatestRelease> {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error('Belum ada rilis di GitHub.');
    if (response.status === 403)
      throw new Error('Batas cek update GitHub tercapai. Coba lagi nanti.');
    throw new Error(`Gagal mengecek update (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as {
    tag_name?: string;
    body?: string;
    assets?: ReleaseAsset[];
  };

  const tag = payload.tag_name ?? '';
  const asset = pickApk(payload.assets ?? []);

  if (!tag || !asset?.browser_download_url) {
    throw new Error('Rilis terbaru tidak memiliki file APK.');
  }

  return {
    tag,
    version: cleanVersion(tag),
    notes: payload.body ?? '',
    apkUrl: asset.browser_download_url,
    size: asset.size ?? 0,
  };
}
