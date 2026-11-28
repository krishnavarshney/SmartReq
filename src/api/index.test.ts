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

import { afterEach, vi } from 'vitest';
import { realApiCall, normalizeUrl, toHeaderRecord } from './index';
import { FinalApiRequest } from '../types';

const req = (overrides: Partial<ReturnType<typeof createDefaultRequest>> = {}) => ({ ...createDefaultRequest(), url: 'https://api.example.com/x', ...overrides });
const env = (pairs: Record<string, string>) => Object.entries(pairs).map(([key, value], i) => ({ id: i, key, value, enabled: true }));

describe('buildFinalRequest', () => {
  it('lets a user header override the automatic Content-Type, case-insensitively', () => {
    const built = buildFinalRequest(
      req({ method: 'POST', body: { type: 'json', jsonBody: '{}' }, headers: [{ id: 1, key: 'content-type', value: 'application/vnd.api+json', enabled: true }] }),
      {},
      []
    );
    expect(toHeaderRecord(built.headers)).toEqual({ 'content-type': 'application/vnd.api+json' });
  });

  it('does not attach a body or Content-Type to GET', () => {
    const built = buildFinalRequest(req({ body: { type: 'json', jsonBody: '{"a":1}' } }), {}, []);
    expect(built.body).toBeUndefined();
    expect(built.headers.find((h) => h.key === 'Content-Type')).toBeUndefined();
  });

  it('applies OAuth2 access tokens and API keys in the query', () => {
    const oauth = buildFinalRequest(req({ auth: { type: 'oauth2', oauth2: { grantType: 'client_credentials', accessToken: '{{tok}}' } } }), {}, env({ tok: 'T' }));
    expect(toHeaderRecord(oauth.headers).Authorization).toBe('Bearer T');
    const apiKey = buildFinalRequest(req({ auth: { type: 'apiKey', apiKeyKey: 'k', apiKeyValue: 'v 1', apiKeyAddTo: 'query' } }), {}, []);
    expect(apiKey.url).toBe('https://api.example.com/x?k=v%201');
  });

  it('fills path variables and respects the per-param encode flag', () => {
    const built = buildFinalRequest(
      req({
        url: '{{base}}/users/:id',
        pathVariables: [{ id: 1, key: 'id', value: '{{uid}}', enabled: true }],
        queryParams: [
          { id: 1, key: 'a', value: 'x y', enabled: true },
          { id: 2, key: 'b', value: 'x,y', enabled: true, encode: false },
          { id: 3, key: 'c', value: 'off', enabled: false },
        ],
      }),
      { uid: '42' },
      env({ base: 'http://h' })
    );
    expect(built.url).toBe('http://h/users/42?a=x%20y&b=x,y');
  });

  it('falls back to the query typed in the URL when the params list is empty', () => {
    const built = buildFinalRequest(req({ url: 'http://h/x?q={{v}}', queryParams: [] }), {}, env({ v: 'a b' }));
    expect(built.url).toBe('http://h/x?q=a%20b');
  });

  it('sends raw bodies with their content type', () => {
    const built = buildFinalRequest(req({ method: 'POST', body: { type: 'raw', rawBody: '<a>{{v}}</a>', rawContentType: 'application/xml' } }), {}, env({ v: '1' }));
    expect(built.body).toBe('<a>1</a>');
    expect(toHeaderRecord(built.headers)['Content-Type']).toBe('application/xml');
  });

  it('runs the pre-request script (variables, headers) unless disabled', () => {
    const request = req({
      url: 'http://h/{{p}}',
      preRequestScript: 'pm.variables.set("p", "set-by-script"); pm.request.headers.add({ key: "X-S", value: pm.variables.get("p") });',
    });
    const built = buildFinalRequest(request, {}, []);
    expect(built.url).toBe('http://h/set-by-script');
    expect(toHeaderRecord(built.headers)['X-S']).toBe('set-by-script');
    expect(buildFinalRequest(request, {}, [], { runScripts: false }).url).toBe('http://h/{{p}}');
  });

  it('marks a failing pre-request script', () => {
    const built = buildFinalRequest(req({ preRequestScript: 'undefinedFn()' }), {}, []);
    expect(built.preRequestError).toMatch(/undefinedFn/);
  });
});

describe('realApiCall', () => {
  const final = (overrides: Partial<FinalApiRequest> = {}): FinalApiRequest => ({
    method: 'GET',
    url: 'http://h/x',
    headers: [],
    body: undefined,
    settings: { followRedirects: true, sslVerification: true },
    ...overrides,
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('parses JSON and measures size in UTF-8 bytes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"n":"é"}', { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const r = await realApiCall(final());
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ n: 'é' });
    expect(r.size?.body).toBe(10);
  });

  it('dedupes headers case-insensitively and normalizes bare hosts', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    await realApiCall(
      final({
        url: 'localhost:4010/x',
        headers: [
          { id: 1, key: 'Accept', value: 'a', enabled: true },
          { id: 2, key: 'accept', value: 'b', enabled: true },
          { id: 3, key: 'X-Off', value: 'c', enabled: false },
        ],
      })
    );
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4010/x');
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ accept: 'b' });
    expect(normalizeUrl('https://a')).toBe('https://a');
  });

  it('explains network/CORS failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const r = await realApiCall(final());
    expect(r.status).toBe(0);
    expect(r.body.message).toMatch(/could not reach the server, or the request was blocked by CORS/i);
  });

  const hangingFetch = () =>
    vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    );

  it('honours the per-request timeout', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const r = await realApiCall(final({ settings: { followRedirects: true, sslVerification: true, timeoutMs: 20 } }));
    expect(r.statusText).toBe('Timeout');
  });

  it('can be cancelled', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const controller = new AbortController();
    const pending = realApiCall(final({ settings: { followRedirects: true, sslVerification: true, timeoutMs: 0 } }), { signal: controller.signal });
    controller.abort();
    expect((await pending).statusText).toBe('Cancelled');
  });

  it('refuses unresolved variables and pre-request errors without sending', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await realApiCall(final({ url: '{{base}}/x' }))).statusText).toBe('Unresolved Variable');
    expect((await realApiCall(final({ preRequestError: 'boom' }))).body.message).toBe('boom');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
