import { describe, expect, it } from 'vitest';

import { isNewerVersion } from './version';

describe('isNewerVersion', () => {
  it('membandingkan tiap bagian versi', () => {
    expect(isNewerVersion('0.6.1', '0.6.0')).toBe(true);
    expect(isNewerVersion('0.6.0', '0.6.1')).toBe(false);
    expect(isNewerVersion('0.10.0', '0.9.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true);
  });

  it('menerima awalan v dan versi yang sama', () => {
    expect(isNewerVersion('v0.6.1', '0.6.0')).toBe(true);
    expect(isNewerVersion('v0.6.0', '0.6.0')).toBe(false);
    expect(isNewerVersion('0.6', '0.6.0')).toBe(false);
  });

  it('mengabaikan suffix pre-release', () => {
    expect(isNewerVersion('0.6.1-beta', '0.6.0')).toBe(true);
  });
});
