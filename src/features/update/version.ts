function parts(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

/** true kalau `latest` lebih baru dari `current` (perbandingan numerik per bagian). */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parts(latest);
  const b = parts(current);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left > right;
  }
  return false;
}
