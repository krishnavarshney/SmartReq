import { FinalApiRequest, ApiResponse, ResponseCookie, ApiRequest, KeyValueItem, HttpMethod } from '../types';
import { buildVariableMap, interpolateString } from '../utils/interpolation';
import { applyPathVariables, parseQueryString, splitUrl } from '../utils/http-data';
import { runPreRequestScript } from '../utils/scripting';

export const DEFAULT_TIMEOUT_MS = 30_000;

const encoder = new TextEncoder();
const byteLength = (s: string): number => encoder.encode(s).length;

// btoa() throws on any non-Latin1 character, which real credentials routinely contain.
export const base64Utf8 = (value: string): string => {
  let binary = '';
  encoder.encode(value).forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const parseSetCookie = (cookieString: string): ResponseCookie[] => {
  if (!cookieString) return [];
  const parts = cookieString.split(';').map((p) => p.trim());
  const [name, ...valueParts] = parts[0].split('=');
  if (!name) return [];

  let value = valueParts.join('=');
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep raw */
  }
  const cookie: ResponseCookie = { name: name.trim(), value, httpOnly: false, secure: false };

  for (let i = 1; i < parts.length; i++) {
    const [partName, ...partValueParts] = parts[i].split('=');
    const partValue = partValueParts.join('=');
    const lowerPartName = partName.toLowerCase().trim();
    if (lowerPartName === 'expires') cookie.expires = partValue;
    else if (lowerPartName === 'path') cookie.path = partValue;
    else if (lowerPartName === 'domain') cookie.domain = partValue;
    else if (lowerPartName === 'samesite') cookie.sameSite = partValue as ResponseCookie['sameSite'];
    else if (lowerPartName === 'secure') cookie.secure = true;
    else if (lowerPartName === 'httponly') cookie.httpOnly = true;
  }
  return [cookie];
};

const errorResponse = (statusText: string, error: string, message: string, startTime: number, hint?: string): ApiResponse => ({
  status: 0,
  statusText,
  headers: {},
  body: hint ? { error, message, hint } : { error, message },
  duration: Date.now() - startTime,
  size: { headers: 0, body: 0, total: 0 },
  cookies: [],
  timing: {},
});

/** Prepend http:// when the user typed a bare host such as `localhost:3000/users`. */
export const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `http:${trimmed}`;
  return `http://${trimmed}`;
};

/** Collapse headers case-insensitively (the last enabled one wins), skipping blank names. */
export const toHeaderRecord = (headers: KeyValueItem[]): Record<string, string> => {
  const byLower = new Map<string, { key: string; value: string }>();
  headers
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => byLower.set(h.key.trim().toLowerCase(), { key: h.key.trim(), value: h.value }));
  const record: Record<string, string> = {};
  byLower.forEach(({ key, value }) => {
    record[key] = value;
  });
  return record;
};

const readTiming = (url: string): Record<string, number> => {
  try {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let entry: PerformanceResourceTiming | undefined;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].initiatorType === 'fetch' && entries[i].name === url) {
        entry = entries[i];
        break;
      }
    }
    // The resource timing buffer is small (250 by default) and stops recording when full.
    if (entries.length > 200) performance.clearResourceTimings();
    // Without a Timing-Allow-Origin header cross-origin phases are zeroed; report nothing rather than invent numbers.
    if (!entry || entry.responseEnd <= 0 || entry.responseStart <= 0) return {};
    return {
      Queueing: Math.max(0, entry.domainLookupStart - entry.startTime),
      'DNS Lookup': Math.max(0, entry.domainLookupEnd - entry.domainLookupStart),
      'TCP Handshake': Math.max(0, entry.connectEnd - entry.connectStart),
      'SSL Handshake': Math.max(0, entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0),
      'Waiting (TTFB)': Math.max(0, entry.responseStart - entry.requestStart),
      'Content Download': Math.max(0, entry.responseEnd - entry.responseStart),
    };
  } catch {
    return {};
  }
};

export interface ApiCallOptions {
  /** Abort the request (e.g. a Cancel button). Resolves with a `Cancelled` response. */
  signal?: AbortSignal;
  /** Override the request's own timeout. 0 disables it. */
  timeoutMs?: number;
}

/**
 * Send a built request with fetch(). Never throws: failures (network, CORS, timeout,
 * cancellation, pre-request script errors) resolve as a status-0 response with an
 * explanatory body.
 */
export const realApiCall = async (req: FinalApiRequest, options: ApiCallOptions = {}): Promise<ApiResponse> => {
  const startTime = Date.now();

  if (req.preRequestError) {
    return errorResponse('Script Error', 'Pre-request script failed', req.preRequestError, startTime, 'Fix the script in the Scripts tab. The request was not sent.');
  }

  const url = normalizeUrl(req.url);
  const unresolved = url.match(/\{\{\s*[^{}]+?\s*\}\}/g);
  if (unresolved) {
    const names = [...new Set(unresolved)].join(', ');
    return errorResponse(
      'Unresolved Variable',
      'Unresolved variable',
      `The URL still contains ${names}.`,
      startTime,
      'Define the variable in the active environment or globals, or select the environment that has it.'
    );
  }
  try {
    new URL(url);
  } catch {
    return errorResponse('Invalid URL', 'Invalid URL', `"${req.url}" is not a valid URL.`, startTime, 'Use a full address such as https://api.example.com/users.');
  }

  const controller = new AbortController();
  let abortReason: 'timeout' | 'cancelled' | null = null;
  const timeoutMs = options.timeoutMs ?? req.settings?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = timeoutMs > 0 ? setTimeout(() => { abortReason = 'timeout'; controller.abort(); }, timeoutMs) : undefined;
  const onExternalAbort = () => {
    abortReason = 'cancelled';
    controller.abort();
  };
  if (options.signal) {
    if (options.signal.aborted) onExternalAbort();
    else options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const headers = toHeaderRecord(req.headers);
    if (req.body instanceof FormData) {
      // The browser must set the multipart boundary itself.
      Object.keys(headers).forEach((k) => {
        if (k.toLowerCase() === 'content-type') delete headers[k];
      });
    }

    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const response = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      signal: controller.signal,
      redirect: req.settings?.followRedirects === false ? 'manual' : 'follow',
    });

    if (response.type === 'opaqueredirect') {
      return errorResponse(
        'Redirect',
        'Redirect not followed',
        'The server answered with a redirect, and following redirects is turned off for this request.',
        startTime,
        'Browsers hide the status and Location of an unfollowed redirect. Turn on "Follow redirects" in Settings to see where it leads.'
      );
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });
    const cookies = parseSetCookie(responseHeaders['set-cookie'] || '');

    let responseBody: unknown;
    let bodyBytes = 0;
    const contentType = (responseHeaders['content-type'] || '').toLowerCase();
    if (contentType.startsWith('image/')) {
      const blob = await response.blob();
      bodyBytes = blob.size;
      responseBody = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
    } else {
      const text = await response.text();
      bodyBytes = byteLength(text);
      responseBody = text;
      if (text && (contentType.includes('/json') || contentType.includes('+json'))) {
        try {
          responseBody = JSON.parse(text);
        } catch {
          /* malformed JSON stays as text */
        }
      }
    }
    const duration = Date.now() - startTime;

    const headerBytes = byteLength(Object.entries(responseHeaders).map(([k, v]) => `${k}: ${v}`).join('\r\n'));
    // Let the browser record the resource timing entry.
    await new Promise((r) => setTimeout(r, 0));

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      duration,
      size: { headers: headerBytes, body: bodyBytes, total: headerBytes + bodyBytes },
      cookies,
      timing: readTiming(response.url || url),
    };
  } catch (error) {
    if (abortReason === 'cancelled') {
      return errorResponse('Cancelled', 'Request cancelled', 'The request was cancelled before a response arrived.', startTime);
    }
    if (abortReason === 'timeout') {
      return errorResponse(
        'Timeout',
        'Request timed out',
        `No response within ${timeoutMs / 1000}s.`,
        startTime,
        'Check that the server is responding, or raise the timeout in the request Settings tab.'
      );
    }
    const mixedContent = typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http:');
    return errorResponse(
      'Network Error',
      'Could not send request',
      'Could not reach the server, or the request was blocked by CORS.',
      startTime,
      mixedContent
        ? 'This page is served over HTTPS, so the browser blocks plain http:// requests (mixed content). Use https:// for the API.'
        : 'Check the URL and that the server is running. If it is, the server must allow this origin with Access-Control-Allow-Origin (and answer the OPTIONS preflight). Browsers do not reveal which of these happened.' +
          (error instanceof Error && error.message ? ` (${error.message})` : '')
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
};

export interface BuildOptions {
  /** Run the request's pre-request script (default true). Pass false for previews. */
  runScripts?: boolean;
}

const sameParams = (a: { key: string; value: string }[], b: { key: string; value: string }[]) =>
  a.length === b.length && a.every((p, i) => p.key === b[i].key && p.value === b[i].value);

/** Resolve variables, scripts, path variables, query, auth and body into the request that is actually sent. */
export const buildFinalRequest = (
  request: ApiRequest,
  data: Record<string, string> = {},
  env: KeyValueItem[] = [],
  options: BuildOptions = {}
): FinalApiRequest => {
  let vars = buildVariableMap(env, data);
  let method: HttpMethod = request.method;
  let urlTemplate = request.url;
  let userHeaders = request.headers;
  let preRequestError: string | undefined;

  if (options.runScripts !== false && request.preRequestScript?.trim()) {
    const result = runPreRequestScript(request.preRequestScript, {
      method,
      url: urlTemplate,
      headers: userHeaders,
      body: request.body.type === 'json' ? request.body.jsonBody : request.body.type === 'raw' ? request.body.rawBody : undefined,
      variables: vars,
    });
    vars = result.variables;
    method = result.method;
    urlTemplate = result.url;
    userHeaders = result.headers;
    preRequestError = result.error;
  }
  const interp = (s: string | undefined) => interpolateString(s || '', vars);

  // Path variables (`/users/:id`) are filled before the URL is interpolated.
  const pathValues: Record<string, string> = {};
  (request.pathVariables || []).forEach((p) => {
    if (p.key && p.enabled !== false) pathValues[p.key] = interp(p.value);
  });
  const { base: rawBase, query: rawQuery } = splitUrl(applyPathVariables(urlTemplate, pathValues));
  const baseUrl = interp(rawBase);

  // The params editor is the source of truth for the query; the URL text is used when the
  // params are empty (e.g. bulk mode, where the two are not kept in sync) or a script rewrote the URL.
  const enabledParams = request.queryParams.filter((p) => p.enabled && p.key);
  const urlParams = parseQueryString(rawQuery);
  const useUrlQuery =
    urlParams.length > 0 &&
    (enabledParams.length === 0 || urlTemplate !== request.url) &&
    !sameParams(urlParams, enabledParams.map((p) => ({ key: p.key, value: p.value })));
  const queryParts: string[] = [];
  if (useUrlQuery) {
    urlParams.forEach((p) => queryParts.push(`${encodeURIComponent(interp(p.key))}=${encodeURIComponent(interp(p.value))}`));
  } else {
    enabledParams.forEach((p) => {
      const value = interp(p.value);
      queryParts.push(`${encodeURIComponent(interp(p.key))}=${p.encode !== false ? encodeURIComponent(value) : value}`);
    });
  }

  const authHeaders: KeyValueItem[] = [];
  const auth = request.auth;
  switch (auth.type) {
    case 'bearer':
    case 'jwt':
      if (auth.token?.trim()) authHeaders.push({ id: -1, key: 'Authorization', value: `Bearer ${interp(auth.token).trim()}`, enabled: true });
      break;
    case 'oauth2':
      if (auth.oauth2?.accessToken?.trim())
        authHeaders.push({ id: -1, key: 'Authorization', value: `Bearer ${interp(auth.oauth2.accessToken).trim()}`, enabled: true });
      break;
    case 'basic':
      if (auth.basicUser || auth.basicPass)
        authHeaders.push({ id: -1, key: 'Authorization', value: `Basic ${base64Utf8(`${interp(auth.basicUser)}:${interp(auth.basicPass)}`)}`, enabled: true });
      break;
    case 'apiKey':
      if (auth.apiKeyKey?.trim()) {
        const key = interp(auth.apiKeyKey).trim();
        const value = interp(auth.apiKeyValue);
        if (auth.apiKeyAddTo === 'query') queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        else authHeaders.push({ id: -1, key, value, enabled: true });
      }
      break;
  }

  const finalUrl = queryParts.length ? `${baseUrl}?${queryParts.join('&')}` : baseUrl;

  let body: string | FormData | undefined;
  let contentType: string | undefined;
  let bodyStructure: KeyValueItem[] | undefined;
  const canHaveBody = method !== 'GET' && method !== 'HEAD';

  if (canHaveBody) {
    switch (request.body.type) {
      case 'json':
        body = interp(request.body.jsonBody);
        contentType = 'application/json';
        break;
      case 'raw':
        body = interp(request.body.rawBody);
        contentType = request.body.rawContentType || 'text/plain';
        break;
      case 'graphql': {
        let variables: unknown;
        if (request.body.graphqlVariables?.trim()) {
          try {
            variables = JSON.parse(interp(request.body.graphqlVariables));
          } catch {
            variables = undefined;
          }
        }
        body = JSON.stringify({ query: interp(request.body.graphqlQuery), variables });
        contentType = 'application/json';
        break;
      }
      case 'form-data': {
        const formData = new FormData();
        const items = (request.body.formData || []).filter((i) => i.enabled && i.key);
        bodyStructure = items.map((i) => ({ ...i, key: interp(i.key), value: interp(i.value) }));
        bodyStructure.forEach((i) => formData.append(i.key, i.value));
        body = formData;
        break;
      }
      case 'x-www-form-urlencoded': {
        const params = new URLSearchParams();
        const items = (request.body.urlEncoded || []).filter((i) => i.enabled && i.key);
        bodyStructure = items.map((i) => ({ ...i, key: interp(i.key), value: interp(i.value) }));
        bodyStructure.forEach((i) => params.append(i.key, i.value));
        body = params.toString();
        contentType = 'application/x-www-form-urlencoded';
        break;
      }
    }
  }

  // Blank rows (the editor's empty trailing row) are not headers; dropping them keeps size accounting honest.
  const interpolatedHeaders = userHeaders.filter((h) => h.key.trim()).map((h) => ({ ...h, key: interp(h.key), value: interp(h.value) }));
  const userHas = (name: string) => interpolatedHeaders.some((h) => h.enabled && h.key.trim().toLowerCase() === name.toLowerCase());
  const autoHeaders: KeyValueItem[] = [];
  if (contentType && !userHas('Content-Type')) autoHeaders.push({ id: -2, key: 'Content-Type', value: contentType, enabled: true });
  authHeaders.forEach((h) => {
    if (!userHas(h.key)) autoHeaders.push(h);
  });

  return {
    method,
    url: finalUrl,
    headers: [...autoHeaders, ...interpolatedHeaders],
    body,
    bodyStructure,
    settings: request.settings,
    ...(preRequestError ? { preRequestError } : {}),
  };
};
