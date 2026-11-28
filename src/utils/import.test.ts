import { describe, it, expect } from 'vitest';
import { detectImportFormat, openApiToCollection, parseOpenApiSpec } from './openapi';
import { parsePostmanCollection } from './postman';

const spec = {
  openapi: '3.0.0',
  info: { title: 'Pets', version: '1' },
  servers: [{ url: 'https://api.example.com/{version}', variables: { version: { default: 'v1' } } }],
  paths: {
    '/pets/{petId}': {
      parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['pets'], summary: 'Get pet', parameters: [{ name: 'expand', in: 'query', schema: { type: 'string', default: 'owner' } }] },
    },
    '/pets': {
      post: {
        tags: ['pets'],
        operationId: 'createPet',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } },
      },
    },
    '/health': { get: { summary: 'Health' } },
  },
  components: { schemas: { Pet: { type: 'object', properties: { name: { type: 'string', example: 'Rex' }, age: { type: 'integer' } } } } },
};

describe('detectImportFormat', () => {
  it('recognizes each format', () => {
    expect(detectImportFormat('curl https://x.dev')).toBe('curl');
    expect(detectImportFormat(JSON.stringify(spec))).toBe('openapi');
    expect(detectImportFormat('openapi: 3.0.0\ninfo:\n  title: x')).toBe('openapi');
    expect(detectImportFormat(JSON.stringify({ info: { name: 'x' }, item: [] }))).toBe('postman');
    expect(detectImportFormat('hello')).toBe('unknown');
  });
});

describe('openApiToCollection', () => {
  it('groups by tag, resolves servers, path params and bodies', () => {
    const c = openApiToCollection(spec);
    expect(c.name).toBe('Pets');
    const folder = c.children[0];
    expect(folder.type === 'folder' && folder.name).toBe('pets');
    if (folder.type !== 'folder') throw new Error('expected folder');
    const get = folder.children[0];
    const post = folder.children[1];
    if (get.type !== 'request' || post.type !== 'request') throw new Error('expected requests');
    expect(get.request.url).toBe('https://api.example.com/v1/pets/{{petId}}');
    expect(get.request.queryParams.map((q) => [q.key, q.value])).toEqual([['expand', 'owner']]);
    expect(post.name).toBe('createPet');
    expect(JSON.parse(post.request.body.jsonBody ?? '')).toEqual({ name: 'Rex', age: 0 });
    expect(c.children[1].name).toBe('Health');
  });

  it('rejects non-OpenAPI documents', () => {
    expect(() => openApiToCollection({ hello: 1 })).toThrow(/not an OpenAPI/);
  });

  it('parses YAML text without network access', async () => {
    const yaml = `openapi: 3.0.0\ninfo:\n  title: Yaml API\n  version: '1'\nservers:\n  - url: https://y.dev\npaths:\n  /a:\n    get:\n      summary: A\n`;
    const c = await parseOpenApiSpec(yaml);
    expect(c.name).toBe('Yaml API');
    expect(c.children[0].type === 'request' && c.children[0].request.url).toBe('https://y.dev/a');
  });
});

describe('parsePostmanCollection', () => {
  it('converts folders, urls, headers, bodies, auth and variables', () => {
    const { collection, variables } = parsePostmanCollection({
      info: { name: 'PM', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] },
      variable: [{ key: 'baseUrl', value: 'https://pm.dev' }],
      item: [
        {
          name: 'Users',
          item: [
            {
              name: 'Create',
              request: {
                method: 'POST',
                header: [{ key: 'X-A', value: '1' }, { key: 'X-Off', value: '2', disabled: true }],
                url: { raw: '{{baseUrl}}/users?x=1', query: [{ key: 'x', value: '1' }] },
                body: { mode: 'raw', raw: '{"a":1}' },
              },
            },
          ],
        },
        { name: 'Ping', request: 'https://pm.dev/ping?y=2' },
      ],
    });
    expect(collection.name).toBe('PM');
    expect(variables.map((v) => v.key)).toEqual(['baseUrl']);
    const folder = collection.children[0];
    if (folder.type !== 'folder') throw new Error('expected folder');
    const create = folder.children[0];
    if (create.type !== 'request') throw new Error('expected request');
    expect(create.request.method).toBe('POST');
    expect(create.request.url).toBe('{{baseUrl}}/users');
    expect(create.request.queryParams[0].key).toBe('x');
    expect(create.request.headers.find((h) => h.key === 'X-Off')?.enabled).toBe(false);
    expect(create.request.body).toEqual({ type: 'json', jsonBody: '{"a":1}' });
    expect(create.request.auth).toEqual({ type: 'bearer', token: '{{token}}' });
    const ping = collection.children[1];
    expect(ping.type === 'request' && ping.request.url).toBe('https://pm.dev/ping');
  });

  it('rejects other JSON', () => {
    expect(() => parsePostmanCollection({ foo: 1 })).toThrow(/not a Postman/);
  });
});

describe('parsePostmanCollection edge cases', () => {
  it('reads v2.0 object-shaped auth', () => {
    const { collection } = parsePostmanCollection({
      info: { name: 'v2', schema: 'https://schema.getpostman.com/json/collection/v2.0.0/collection.json' },
      auth: { type: 'bearer', bearer: { token: 'abc' } },
      item: [{ name: 'r', request: { method: 'GET', url: 'https://x.com/a' } }],
    });
    const req = collection.children[0];
    expect(req.type === 'request' && req.request.auth).toMatchObject({ type: 'bearer', token: 'abc' });
  });

  it('does not throw on a lone % in a query string', () => {
    const { collection } = parsePostmanCollection({
      info: { name: 'pct' },
      item: [{ name: 'r', request: { method: 'GET', url: 'https://x.com/a?pct=100%' } }],
    });
    const req = collection.children[0];
    expect(req.type === 'request' && req.request.queryParams[0].value).toBe('100%');
  });
});
