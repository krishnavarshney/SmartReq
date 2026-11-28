import { KeyValueItem } from '../types';

export const COMMON_HEADERS: string[] = [
  'Accept',
  'Accept-Charset',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'Cookie',
  'Date',
  'Host',
  'If-Match',
  'If-None-Match',
  'Origin',
  'Pragma',
  'Referer',
  'User-Agent',
  'X-Requested-With',
  'X-CSRF-Token',
];

/**
 * Headers a browser controls itself. fetch() silently drops them (or refuses the request),
 * so the UI should warn instead of pretending they are sent.
 */
const FORBIDDEN_HEADERS = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
]);

export const isForbiddenHeader = (name: string): boolean => {
  const lower = name.trim().toLowerCase();
  return FORBIDDEN_HEADERS.has(lower) || lower.startsWith('proxy-') || lower.startsWith('sec-');
};

export const RAW_CONTENT_TYPES: { value: string; label: string }[] = [
  { value: 'text/plain', label: 'Text' },
  { value: 'application/xml', label: 'XML' },
  { value: 'text/html', label: 'HTML' },
  { value: 'application/javascript', label: 'JavaScript' },
  { value: 'text/csv', label: 'CSV' },
];

/** decodeURIComponent that never throws (a lone `%` stays as typed). */
export const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Split a URL template into the part before `?`, the query string and the `#hash`. */
export const splitUrl = (url: string): { base: string; query: string; hash: string } => {
  const hashIdx = url.indexOf('#');
  const withoutHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
  const qIdx = withoutHash.indexOf('?');
  if (qIdx < 0) return { base: withoutHash, query: '', hash };
  return { base: withoutHash.slice(0, qIdx), query: withoutHash.slice(qIdx + 1), hash };
};

/**
 * Parse a query string as typed by a person. Unlike URLSearchParams this keeps `+`
 * and `{{variables}}` exactly as written and never throws on malformed escapes.
 */
export const parseQueryString = (query: string): { key: string; value: string }[] => {
  if (!query) return [];
  return query
    .split('&')
    .filter((part) => part.length > 0)
    .map((part) => {
      const eq = part.indexOf('=');
      const rawKey = eq >= 0 ? part.slice(0, eq) : part;
      const rawValue = eq >= 0 ? part.slice(eq + 1) : '';
      return { key: safeDecode(rawKey), value: safeDecode(rawValue) };
    });
};

/** Escape only what would break the query structure, so the URL stays readable. */
const escapeQueryPart = (text: string, isKey: boolean) =>
  text.replace(isKey ? /[&#=]/g : /[&#]/g, (c) => encodeURIComponent(c));

/** Inverse of parseQueryString for display in the URL field. */
export const serializeQuery = (params: { key: string; value: string }[]): string =>
  params.map((p) => `${escapeQueryPart(p.key, true)}=${escapeQueryPart(p.value, false)}`).join('&');

const ORIGIN_RE = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i;
const PATH_VAR_RE = /\/:([A-Za-z_][\w-]*)/g;

/** Names of `:name` path segments, e.g. `/users/:id` -> ['id']. Ports are ignored. */
export const extractPathVariableNames = (url: string): string[] => {
  const path = splitUrl(url).base.replace(ORIGIN_RE, '');
  const names: string[] = [];
  for (const match of path.matchAll(PATH_VAR_RE)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
};

/** Replace `:name` path segments with (URL-encoded) values. Unknown or empty names are left as typed. */
export const applyPathVariables = (url: string, values: Record<string, string>): string => {
  const originMatch = url.match(ORIGIN_RE);
  const origin = originMatch ? originMatch[0] : '';
  const rest = url.slice(origin.length);
  const { base, query, hash } = splitUrl(rest);
  const replaced = base.replace(PATH_VAR_RE, (whole, name: string) => {
    const value = values[name];
    return value ? `/${encodeURIComponent(value)}` : whole;
  });
  return `${origin}${replaced}${query ? `?${query}` : ''}${hash}`;
};

/** Keep `pathVariables` in step with the `:name` segments in the URL, preserving existing values. */
export const syncPathVariables = (url: string, current: KeyValueItem[] = []): KeyValueItem[] => {
  const names = extractPathVariableNames(url);
  return names.map((name, i) => {
    const existing = current.find((item) => item.key === name);
    return existing ?? { id: Date.now() + i, key: name, value: '', enabled: true };
  });
};

const VARIABLE_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Unique `{{variable}}` names referenced in a string, in order of appearance. */
export const extractVariableNames = (text: string): string[] => {
  const names: string[] = [];
  for (const match of (text || '').matchAll(VARIABLE_RE)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
};

/**
 * Validate JSON that may contain `{{variables}}`, which are only replaced at send time.
 * Returns null when valid (or empty), otherwise the parser's message.
 */
export const validateJsonTemplate = (text: string): string | null => {
  if (!text || !text.trim()) return null;
  try {
    JSON.parse(text.replace(VARIABLE_RE, '0'));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid JSON';
  }
};

/**
 * Pretty-print JSON that may contain `{{variables}}` (quoted or not) without losing them.
 * Throws when the text is not valid JSON even with variables substituted.
 */
export const formatJsonTemplate = (text: string, indent: number | '' = 2): string => {
  const tokens: string[] = [];
  const base = 7_310_000_000;
  const withSentinels = text.replace(VARIABLE_RE, (whole) => {
    tokens.push(whole);
    return String(base + tokens.length - 1);
  });
  const formatted = JSON.stringify(JSON.parse(withSentinels), null, indent === '' ? undefined : indent);
  return formatted.replace(/7310\d{6}/g, (n) => {
    const idx = Number(n) - base;
    return tokens[idx] ?? n;
  });
};
