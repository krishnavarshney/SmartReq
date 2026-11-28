import { describe, it, expect } from 'vitest';
import { parseCurl } from './curl';

describe('parseCurl', () => {
  it('splits the query string, headers and JSON body', () => {
    const parsed = parseCurl(
      `curl -X POST 'https://api.example.com/v1/items?a=1&b=two' -H 'Content-Type: application/json' -H 'X-Token: abc' -d '{"name":"x"}'`,
    );

    expect(parsed.method).toBe('POST');
    expect(parsed.url).toBe('https://api.example.com/v1/items');
    expect(parsed.queryParams?.map(p => [p.key, p.value])).toEqual([['a', '1'], ['b', 'two']]);
    expect(parsed.headers?.map(h => [h.key, h.value])).toContainEqual(['X-Token', 'abc']);
    expect(parsed.body?.type).toBe('json');
    expect(JSON.parse(parsed.body?.jsonBody ?? '')).toEqual({ name: 'x' });
  });

  it('defaults to GET with no body', () => {
    const parsed = parseCurl('curl https://api.example.com/users/1');
    expect(parsed.method).toBe('GET');
    expect(parsed.body?.type).toBe('none');
  });

  it('keeps a // inside a string value instead of stripping it as a comment', () => {
    const parsed = parseCurl(`curl -X POST https://api.example.com/x -d '{"site":"https://a.b/c"}'`);
    expect(JSON.parse(parsed.body?.jsonBody ?? '')).toEqual({ site: 'https://a.b/c' });
  });

  it('handles multipart form uploads', () => {
    const parsed = parseCurl(`curl -X PUT https://api.example.com/x -F 'file=@a.png'`);
    expect(parsed.method).toBe('PUT');
  });

  it('throws on garbage input', () => {
    expect(() => parseCurl('not a curl command')).toThrow();
  });
});

describe('parseCurl repeated keys', () => {
  it('keeps each value of a repeated query key as its own param', () => {
    const req = parseCurl(`curl 'https://x.com/a?id=1&id=2'`);
    expect(req.queryParams?.filter((p) => p.key === 'id').map((p) => p.value)).toEqual(['1', '2']);
  });
});
