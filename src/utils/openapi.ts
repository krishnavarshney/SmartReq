import SwaggerParser from '@apidevtools/swagger-parser';
import { v4 as uuidv4 } from 'uuid';
import { Collection, Folder, RequestItem, RequestNode, HttpMethod, KeyValueItem, ApiRequest } from '../types';
import { createDefaultRequest } from './collection';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ImportFormat = 'curl' | 'openapi' | 'postman' | 'unknown';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

let idSeq = 0;
const kvId = () => Date.now() * 1000 + (idSeq++ % 1000);

/** Guess what a pasted / uploaded text is. */
export const detectImportFormat = (text: string): ImportFormat => {
  const t = text.trim();
  if (!t) return 'unknown';
  if (/^curl\s/i.test(t)) return 'curl';
  if (t.startsWith('{')) {
    try {
      const obj = JSON.parse(t);
      if (obj?.openapi || obj?.swagger) return 'openapi';
      if (obj?.info && Array.isArray(obj?.item)) return 'postman';
    } catch {
      return 'unknown';
    }
    return 'unknown';
  }
  if (/^\s*["']?(openapi|swagger)["']?\s*:/m.test(t)) return 'openapi';
  return 'unknown';
};

// Helper to generate a placeholder value from a JSON schema.
const generateValueFromSchema = (schema: any, depth = 0): any => {
  if (!schema || depth > 6) return '';
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.allOf) return Object.assign({}, ...schema.allOf.map((s: any) => generateValueFromSchema(s, depth + 1)));
  if (schema.oneOf || schema.anyOf) return generateValueFromSchema((schema.oneOf || schema.anyOf)[0], depth + 1);
  switch (schema.type) {
    case 'string':
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'date') return new Date().toISOString().slice(0, 10);
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
      return 'string';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return schema.items ? [generateValueFromSchema(schema.items, depth + 1)] : [];
    case 'object':
    default: {
      if (!schema.properties) return schema.type === 'object' ? {} : '';
      const obj: Record<string, any> = {};
      for (const prop in schema.properties) obj[prop] = generateValueFromSchema(schema.properties[prop], depth + 1);
      return obj;
    }
  }
};

/** Resolve a local `#/...` $ref inside the document (bundle() keeps internal refs). */
const deref = (api: any, value: any, depth = 0): any => {
  if (!value || typeof value !== 'object' || depth > 20) return value;
  if (typeof value.$ref === 'string' && value.$ref.startsWith('#/')) {
    const target = value.$ref
      .slice(2)
      .split('/')
      .reduce((acc: any, key: string) => acc?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], api);
    return deref(api, target, depth + 1);
  }
  return value;
};

const derefSchema = (api: any, schema: any, depth = 0): any => {
  const s = deref(api, schema);
  if (!s || typeof s !== 'object' || depth > 8) return s;
  const out: any = { ...s };
  if (s.properties) {
    out.properties = {};
    for (const k in s.properties) out.properties[k] = derefSchema(api, s.properties[k], depth + 1);
  }
  if (s.items) out.items = derefSchema(api, s.items, depth + 1);
  for (const k of ['allOf', 'oneOf', 'anyOf']) if (Array.isArray(s[k])) out[k] = s[k].map((x: any) => derefSchema(api, x, depth + 1));
  return out;
};

const resolveBaseUrl = (api: any, sourceUrl?: string): string => {
  let base = '';
  if (Array.isArray(api.servers) && api.servers.length > 0) {
    const server = api.servers[0];
    base = String(server.url || '');
    for (const [name, v] of Object.entries<any>(server.variables || {})) base = base.split(`{${name}}`).join(String(v?.default ?? ''));
  } else if (api.host) {
    const scheme = api.schemes?.[0] || 'https';
    base = `${scheme}://${api.host}${api.basePath || ''}`;
  }
  if (base && !/^[a-z]+:\/\//i.test(base) && sourceUrl) {
    try {
      base = new URL(base, sourceUrl).toString();
    } catch {
      /* keep relative */
    }
  }
  return base.replace(/\/+$/, '');
};

/** Convert a parsed OpenAPI 3 / Swagger 2 document to a collection. Operations are grouped by their first tag. */
export const openApiToCollection = (api: any, sourceUrl?: string): Collection => {
  if (!api || typeof api !== 'object' || !(api.openapi || api.swagger)) throw new Error('This is not an OpenAPI or Swagger document.');
  if (!api.paths || typeof api.paths !== 'object') throw new Error('The document has no paths.');

  const baseUrl = resolveBaseUrl(api, sourceUrl);
  const folders = new Map<string, Folder>();
  const root: RequestNode[] = [];

  for (const path of Object.keys(api.paths)) {
    const pathItem = deref(api, api.paths[path]);
    if (!pathItem) continue;
    const sharedParams: any[] = (pathItem.parameters || []).map((p: any) => deref(api, p));

    for (const method of Object.keys(pathItem)) {
      if (!HTTP_METHODS.includes(method.toLowerCase())) continue;
      const operation = pathItem[method];
      if (!operation || typeof operation !== 'object') continue;

      const opParams: any[] = (operation.parameters || []).map((p: any) => deref(api, p));
      const params = [...sharedParams.filter((sp) => !opParams.some((op) => op.name === sp.name && op.in === sp.in)), ...opParams];
      const valueOf = (p: any) => {
        const v = p.example ?? p.schema?.example ?? p.schema?.default ?? p.default;
        return v === undefined ? '' : String(v);
      };

      const request: ApiRequest = {
        ...createDefaultRequest(),
        method: method.toUpperCase() as HttpMethod,
        // `/pets/{petId}` -> `/pets/{{petId}}` so path params become variables.
        url: `${baseUrl}${path.replace(/\{([^}]+)\}/g, '{{$1}}')}`,
        queryParams: params
          .filter((p) => p.in === 'query')
          .map((p): KeyValueItem => ({ id: kvId(), key: p.name, value: valueOf(p), enabled: !!p.required || valueOf(p) !== '', encode: true })),
        headers: params.filter((p) => p.in === 'header').map((p): KeyValueItem => ({ id: kvId(), key: p.name, value: valueOf(p), enabled: true })),
      };

      // Request body: OpenAPI 3 requestBody, or Swagger 2 `in: body` parameter.
      const requestBody = deref(api, operation.requestBody);
      const content = requestBody?.content || {};
      const jsonType = Object.keys(content).find((t) => t.includes('json'));
      const bodyParam = params.find((p) => p.in === 'body');
      if (jsonType || bodyParam) {
        const media = jsonType ? content[jsonType] : null;
        const example =
          media?.example ??
          (media?.examples && deref(api, Object.values<any>(media.examples)[0])?.value) ??
          generateValueFromSchema(derefSchema(api, media?.schema ?? bodyParam?.schema));
        request.body = { type: 'json', jsonBody: JSON.stringify(example, null, 2) };
        request.headers = [...request.headers, { id: kvId(), key: 'Content-Type', value: 'application/json', enabled: true }];
      } else if (content['application/x-www-form-urlencoded']) {
        const schema = derefSchema(api, content['application/x-www-form-urlencoded'].schema);
        request.body = {
          type: 'x-www-form-urlencoded',
          urlEncoded: Object.keys(schema?.properties || {}).map((k) => ({ id: kvId(), key: k, value: '', enabled: true })),
        };
      }

      const item: RequestItem = {
        id: uuidv4(),
        type: 'request',
        name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
        request,
        responses: [],
      };

      const tag = Array.isArray(operation.tags) && operation.tags[0];
      if (tag) {
        let folder = folders.get(tag);
        if (!folder) {
          folder = { id: uuidv4(), type: 'folder', name: tag, children: [] };
          folders.set(tag, folder);
          root.push(folder);
        }
        folder.children.push(item);
      } else {
        root.push(item);
      }
    }
  }

  if (root.length === 0) throw new Error('The document does not define any operations.');
  return { id: uuidv4(), type: 'collection', name: api.info?.title || 'Imported API', children: root };
};

/** Parse OpenAPI text (JSON or YAML) without touching the network. External $refs are not followed. */
const bundleText = async (text: string): Promise<any> => {
  const isJson = text.trim().startsWith('{');
  const file = isJson ? 'memory://spec.json' : 'memory://spec.yaml';
  return SwaggerParser.bundle(file, {
    resolve: {
      file: false,
      http: false,
      memory: { order: 1, canRead: /^memory:/i, read: () => text },
    } as any,
  });
};

/**
 * Parse an OpenAPI / Swagger spec into a collection.
 * `source` may be a URL (fetched by the browser, so it must allow CORS), raw JSON / YAML text, or a File.
 */
export const parseOpenApiSpec = async (source: string | File): Promise<Collection> => {
  try {
    if (source instanceof File) return openApiToCollection(await bundleText(await source.text()));
    const trimmed = source.trim();
    if (/^https?:\/\//i.test(trimmed) && !/\s/.test(trimmed)) {
      return openApiToCollection(await SwaggerParser.bundle(trimmed), trimmed);
    }
    return openApiToCollection(await bundleText(trimmed));
  } catch (err: any) {
    const msg: string = err?.message || '';
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      throw new Error('Could not download the spec. The server may block cross-origin requests (CORS); download the file and upload it instead.');
    }
    throw new Error(msg.replace(/^Error (parsing|resolving) .*?:\s*/i, '') || 'Failed to parse the OpenAPI/Swagger specification.');
  }
};
