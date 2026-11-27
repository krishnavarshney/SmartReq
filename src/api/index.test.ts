import { describe, it, expect } from 'vitest';
import { buildFinalRequest } from './index';
import { createDefaultRequest } from '../utils/collection';

const decodeBasic = (header: string): string => {
  const encoded = header.replace(/^Basic /, '');
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

describe('buildFinalRequest basic auth', () => {
  it('encodes non-ASCII credentials without throwing', () => {
    const request = createDefaultRequest();
    request.url = 'https://api.example.com/x';
    request.auth = { type: 'basic', basicUser: 'राम', basicPass: 'pässwörd' };

    const built = buildFinalRequest(request, {}, []);
    const header = built.headers.find(h => h.key === 'Authorization');

    expect(header?.value).toMatch(/^Basic /);
    expect(decodeBasic(header!.value)).toBe('राम:pässwörd');
  });

  it('still encodes plain ASCII credentials', () => {
    const request = createDefaultRequest();
    request.url = 'https://api.example.com/x';
    request.auth = { type: 'basic', basicUser: 'user', basicPass: 'pass' };

    const built = buildFinalRequest(request, {}, []);
    const header = built.headers.find(h => h.key === 'Authorization');

    expect(decodeBasic(header!.value)).toBe('user:pass');
  });
});
