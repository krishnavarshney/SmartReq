import { describe, it, expect } from 'vitest';
import { paramsFromUrl, urlFromParams } from './useUrlSync';

describe('url <-> params', () => {
  it('rebuilds params from the URL, keeping ids, encode flags and disabled rows', () => {
    const current = [
      { id: 1, key: 'a', value: 'old', enabled: true, encode: false },
      { id: 2, key: 'off', value: 'x', enabled: false },
    ];
    const rows = paramsFromUrl('http://h/x?a=1&b={{v}}', current);
    expect(rows.map((r) => [r.id === 1, r.key, r.value, r.enabled, r.encode])).toEqual([
      [true, 'a', '1', true, false],
      [false, 'b', '{{v}}', true, true],
      [false, 'off', 'x', false, undefined],
    ]);
  });

  it('writes enabled params into the URL without encoding variables', () => {
    expect(
      urlFromParams('http://h/x?old=1#frag', [
        { id: 1, key: 'q', value: '{{v}}', enabled: true },
        { id: 2, key: 'off', value: '1', enabled: false },
        { id: 3, key: '', value: 'nokey', enabled: true },
      ])
    ).toBe('http://h/x?q={{v}}#frag');
    expect(urlFromParams('http://h/x?old=1', [])).toBe('http://h/x');
  });
});
