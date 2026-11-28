import { v4 as uuidv4 } from 'uuid';
import { ApiRequest, AuthDetails, BodyDetails, Collection, HttpMethod, KeyValueItem, RequestNode } from '../types';
import { createDefaultRequest } from './collection';
import { safeDecode } from './http-data';

/* eslint-disable @typescript-eslint/no-explicit-any */

let seq = 0;
const kvId = () => Date.now() * 1000 + (seq++ % 1000);

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

const toKv = (list: any[] | undefined): KeyValueItem[] =>
  (list || [])
    .filter((x) => x && typeof x.key === 'string')
    .map((x) => ({ id: kvId(), key: x.key, value: x.value == null ? '' : String(x.value), enabled: !x.disabled, encode: true }));

/** v2.1 stores auth params as [{key, value}]; v2.0 as a plain object ({ token: '...' }). */
const authParam = (list: any, key: string): string => {
  if (!list) return '';
  const value = Array.isArray(list) ? list.find((x) => x?.key === key)?.value : typeof list === 'object' ? list[key] : undefined;
  return value == null ? '' : String(value);
};

const convertAuth = (auth: any): AuthDetails => {
  if (!auth || typeof auth !== 'object') return { type: 'none' };
  switch (auth.type) {
    case 'bearer':
      return { type: 'bearer', token: authParam(auth.bearer, 'token') };
    case 'basic':
      return { type: 'basic', basicUser: authParam(auth.basic, 'username'), basicPass: authParam(auth.basic, 'password') };
    case 'apikey':
      return {
        type: 'apiKey',
        apiKeyKey: authParam(auth.apikey, 'key'),
        apiKeyValue: authParam(auth.apikey, 'value'),
        apiKeyAddTo: authParam(auth.apikey, 'in') === 'query' ? 'query' : 'header',
      };
    default:
      return { type: 'none' };
  }
};

const convertBody = (body: any): BodyDetails => {
  if (!body || typeof body !== 'object') return { type: 'none' };
  switch (body.mode) {
    case 'raw': {
      if (!body.raw) return { type: 'none' };
      const raw = String(body.raw);
      const language = body.options?.raw?.language;
      if (language === 'json' || (!language && /^\s*[[{]/.test(raw))) return { type: 'json', jsonBody: raw };
      const contentTypes: Record<string, string> = {
        xml: 'application/xml',
        html: 'text/html',
        javascript: 'application/javascript',
        text: 'text/plain',
      };
      return { type: 'raw', rawBody: raw, rawContentType: contentTypes[language] ?? 'text/plain' };
    }
    case 'urlencoded':
      return { type: 'x-www-form-urlencoded', urlEncoded: toKv(body.urlencoded) };
    case 'formdata':
      return { type: 'form-data', formData: toKv((body.formdata || []).filter((f: any) => f.type !== 'file')) };
    case 'graphql':
      return {
        type: 'graphql',
        graphqlQuery: body.graphql?.query || '',
        graphqlVariables: typeof body.graphql?.variables === 'string' ? body.graphql.variables : JSON.stringify(body.graphql?.variables ?? {}, null, 2),
      };
    default:
      return { type: 'none' };
  }
};

const convertUrl = (url: any): { url: string; query: KeyValueItem[] } => {
  if (!url) return { url: '', query: [] };
  if (typeof url === 'string') {
    const [base] = url.split('?');
    return { url: base, query: queryFromString(url) };
  }
  let raw: string = url.raw || '';
  if (!raw) {
    const host = Array.isArray(url.host) ? url.host.join('.') : url.host || '';
    const path = Array.isArray(url.path) ? url.path.join('/') : url.path || '';
    raw = `${url.protocol ? `${url.protocol}://` : ''}${host}${path ? `/${path}` : ''}`;
  }
  const query = Array.isArray(url.query) ? toKv(url.query) : queryFromString(raw);
  return { url: raw.split('?')[0], query };
};

const queryFromString = (raw: string): KeyValueItem[] => {
  const q = raw.split('?')[1];
  if (!q) return [];
  return q
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const [k, ...v] = pair.split('=');
      return { id: kvId(), key: safeDecode(k), value: safeDecode(v.join('=')), enabled: true, encode: true };
    });
};

const convertItems = (items: any[], inheritedAuth: any): RequestNode[] =>
  (items || []).map((item: any): RequestNode => {
    if (Array.isArray(item.item)) {
      return { id: uuidv4(), type: 'folder', name: item.name || 'Folder', children: convertItems(item.item, item.auth ?? inheritedAuth) };
    }
    const req = typeof item.request === 'string' ? { url: item.request, method: 'GET' } : item.request || {};
    const { url, query } = convertUrl(req.url);
    const method = String(req.method || 'GET').toUpperCase() as HttpMethod;
    const body = convertBody(req.body);
    const request: ApiRequest = {
      ...createDefaultRequest(),
      method: METHODS.includes(method) ? method : 'GET',
      url,
      queryParams: query,
      headers: toKv(req.header),
      auth: convertAuth(req.auth ?? inheritedAuth),
      body,
    };
    return { id: uuidv4(), type: 'request', name: item.name || `${request.method} ${url}`, request, responses: [] };
  });

export interface PostmanImport {
  collection: Collection;
  /** Collection-level variables; SmartReq has no collection scope, so callers may add them to globals. */
  variables: KeyValueItem[];
}

/** Convert a Postman Collection (v2.0 / v2.1) JSON object. */
export const parsePostmanCollection = (json: any): PostmanImport => {
  if (!json || typeof json !== 'object' || !json.info || !Array.isArray(json.item)) {
    throw new Error('This is not a Postman collection (v2.0 or v2.1).');
  }
  if (typeof json.info.schema === 'string' && /v1\.0\.0/.test(json.info.schema)) {
    throw new Error('Postman v1 collections are not supported. Re-export it from Postman as Collection v2.1.');
  }
  const children = convertItems(json.item, json.auth);
  return {
    collection: { id: uuidv4(), type: 'collection', name: json.info.name || 'Postman collection', children },
    variables: toKv(json.variable),
  };
};
