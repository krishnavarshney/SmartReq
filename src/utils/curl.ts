import { toJsonObject } from 'curlconverter';
import { ApiRequest, AuthDetails, BodyDetails, HttpMethod, KeyValueItem } from '../types';

let seq = 0;
const nextId = () => Date.now() * 1000 + (seq++ % 1000);

/** Repeated keys (curlconverter gives them as arrays) become one row per value, preserving `?id=1&id=2`. */
const toItems = (record: Record<string, unknown> | [string, unknown][] | undefined): KeyValueItem[] => {
  const entries = Array.isArray(record) ? record : Object.entries(record ?? {});
  return entries.flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value]).map((v) => ({
      id: nextId(),
      key,
      value: typeof v === 'string' ? v : JSON.stringify(v),
      enabled: true,
    }))
  );
};

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

/** Parse a cURL command into the parts of a request (method, URL, query, headers, auth and body). */
export const parseCurl = (curlCommand: string): Partial<ApiRequest> => {
  let parsed: ReturnType<typeof toJsonObject>;
  try {
    // Join backslash line continuations (LF or CRLF).
    parsed = toJsonObject(curlCommand.replace(/\\\r?\n/g, ' '));
  } catch {
    throw new Error('Invalid cURL command provided.');
  }

  if (!parsed.url) {
    throw new Error('Could not parse URL from cURL command');
  }

  const headers = toItems(parsed.headers as Record<string, unknown> | undefined);
  const contentTypeHeader = headers.find((h) => h.key.toLowerCase() === 'content-type');
  const contentType = contentTypeHeader?.value.toLowerCase() ?? '';
  const data = parsed.data as unknown;
  const files = (parsed as { files?: Record<string, string> }).files;

  let body: BodyDetails = { type: 'none' };
  if (files && Object.keys(files).length > 0) {
    // Multipart: the browser sets the boundary, so drop any copied Content-Type.
    const fields = toItems(typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : undefined);
    Object.entries(files).forEach(([key, file]) => fields.push({ id: nextId(), key, value: `@${file}`, enabled: true }));
    body = { type: 'form-data', formData: fields };
    if (contentTypeHeader) headers.splice(headers.indexOf(contentTypeHeader), 1);
  } else if (data !== undefined && data !== null && data !== '') {
    if (typeof data === 'object' && contentType.includes('x-www-form-urlencoded')) {
      body = { type: 'x-www-form-urlencoded', urlEncoded: toItems(data as Record<string, unknown>) };
    } else if (typeof data === 'object') {
      body = { type: 'json', jsonBody: JSON.stringify(data, null, 2) };
    } else {
      const text = String(data);
      let json: string | null = null;
      try {
        json = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        json = null;
      }
      if (json !== null && (!contentType || contentType.includes('json') || contentType.includes('x-www-form-urlencoded'))) {
        // `curl -d '{...}'` defaults to a form Content-Type, but the intent is JSON.
        body = { type: 'json', jsonBody: json };
        if (contentTypeHeader && !contentType.includes('json')) headers.splice(headers.indexOf(contentTypeHeader), 1);
      } else if (contentType.includes('x-www-form-urlencoded')) {
        body = { type: 'x-www-form-urlencoded', urlEncoded: toItems(Array.from(new URLSearchParams(text).entries())) };
      } else if (contentType && !contentType.includes('json')) {
        body = { type: 'raw', rawBody: text, rawContentType: contentType.split(';')[0].trim() };
      } else {
        body = { type: 'json', jsonBody: text };
      }
    }
  }

  let auth: AuthDetails = { type: 'none' };
  const curlAuth = (parsed as { auth?: { user?: string; password?: string } }).auth;
  if (curlAuth && (curlAuth.user || curlAuth.password)) {
    auth = { type: 'basic', basicUser: curlAuth.user ?? '', basicPass: curlAuth.password ?? '' };
  }

  const rawMethod = String(parsed.method || (body.type !== 'none' ? 'post' : 'get')).toUpperCase() as HttpMethod;
  const queryParams = toItems(parsed.queries as Record<string, unknown> | undefined);

  return {
    method: METHODS.includes(rawMethod) ? rawMethod : 'GET',
    url: parsed.url, // the query lives in queryParams; the URL field re-syncs it
    queryParams,
    headers,
    auth,
    body,
  };
};
