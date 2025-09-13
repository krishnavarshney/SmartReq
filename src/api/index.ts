import { FinalApiRequest, ApiResponse, ResponseCookie, ApiRequest, KeyValueItem, RequestSettings } from '../types';
import { interpolateString } from '../utils/interpolation';

const parseSetCookie = (cookieString: string): ResponseCookie[] => {
    if (!cookieString) return [];
    const parts = cookieString.split(';').map(p => p.trim());
    const [name, ...valueParts] = parts[0].split('=');
    if (!name) return [];

    const cookie: ResponseCookie = {
        name: name.trim(),
        value: decodeURIComponent(valueParts.join('=')),
        httpOnly: false,
        secure: false,
    };

    for (let i = 1; i < parts.length; i++) {
        const [partName, ...partValueParts] = parts[i].split('=');
        const partValue = partValueParts.join('=');
        const lowerPartName = partName.toLowerCase().trim();
        
        if (lowerPartName === 'expires') cookie.expires = partValue;
        else if (lowerPartName === 'path') cookie.path = partValue;
        else if (lowerPartName === 'domain') cookie.domain = partValue;
        else if (lowerPartName === 'samesite') cookie.sameSite = partValue as any;
        else if (lowerPartName === 'secure') cookie.secure = true;
        else if (lowerPartName === 'httponly') cookie.httpOnly = true;
    }
    return [cookie];
}

export const realApiCall = async (req: FinalApiRequest): Promise<ApiResponse> => {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const headers: Record<string, string> = req.headers
      .filter(h => h.enabled && h.key)
      .reduce((acc, h) => {
        acc[h.key] = h.value;
        return acc;
      }, {} as Record<string, string>);

    if (req.body instanceof FormData) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }

    const response = await fetch(req.url, {
      method: req.method,
      headers: headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      signal: controller.signal,
      redirect: req.settings.followRedirects ? 'follow' : 'manual',
    });
    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });
    
    const cookies = parseSetCookie(responseHeaders['set-cookie'] || '');

    let responseBody: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.startsWith('image/')) {
      try {
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        responseBody = dataUrl; // data URL string for easy preview
      } catch (e) {
        responseBody = await response.text();
      }
    } else if (contentType && contentType.includes('application/json')) {
      try {
        responseBody = await response.json();
      } catch (e) {
        responseBody = await response.text();
      }
    } else {
      responseBody = await response.text();
    }
    
    const responseHeadersString = Object.entries(responseHeaders).map(([k, v]) => `${k}: ${v}`).join('\n');
    const responseBodyString = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
    
    const responseSize = {
        headers: new Blob([responseHeadersString]).size,
        body: new Blob([responseBodyString]).size,
        total: new Blob([responseHeadersString]).size + new Blob([responseBodyString]).size,
    };
    
    // Try to collect real resource timing; fallback to simulated if unavailable (e.g., missing TAO header)
    let timing: Record<string, number> = {};
    try {
      // Give the browser a brief moment to record the performance entry
      await new Promise(r => setTimeout(r, 0));
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      // Match by final URL if available, else request URL
      const targetUrl = (response.url || req.url);
      const entry = entries.reverse().find(e => e.initiatorType === 'fetch' && e.name === targetUrl);
      if (entry && entry.responseEnd > 0) {
        const dns = Math.max(0, entry.domainLookupEnd - entry.domainLookupStart);
        const tcp = Math.max(0, entry.connectEnd - entry.connectStart);
        const ssl = Math.max(0, entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0);
        const ttfb = Math.max(0, entry.responseStart - entry.requestStart);
        const download = Math.max(0, entry.responseEnd - entry.responseStart);
        timing = {
          'DNS Lookup': dns,
          'TCP Handshake': tcp,
          'SSL Handshake': ssl,
          'Waiting (TTFB)': ttfb,
          'Content Download': download,
        };
      } else {
        // Fallback simulated timing
        const phases = ['DNS Lookup', 'TCP Handshake', 'SSL Handshake', 'Waiting (TTFB)', 'Content Download'];
        let remaining = duration;
        for (let i = 0; i < phases.length - 1; i++) {
          const phaseTime = Math.random() * (remaining * 0.1);
          timing[phases[i]] = phaseTime;
          remaining -= phaseTime;
        }
        timing[phases[phases.length - 1]] = Math.max(0, remaining);
      }
    } catch {
      // Ignore errors and keep timing empty or simulated
    }
    
    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      duration,
      size: responseSize,
      cookies,
      timing,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return {
      status: 0,
      statusText: error.name === 'AbortError' ? 'Timeout' : 'Network Error',
      headers: {},
      body: { error: "Request Failed", message: error.message || "Could not connect to the server." },
      duration: Date.now() - startTime,
      cookies: [],
    };
  }
};

export const buildFinalRequest = (request: ApiRequest, data: Record<string,string> = {}, env: KeyValueItem[]): FinalApiRequest => {
    const combinedVariables: Record<string, string> = {};

    // Add globals/env first, case-insensitively
    env.filter(t => t.enabled && t.key).forEach(tag => {
        combinedVariables[tag.key.toLowerCase()] = tag.value;
    });

    // Add data variables, overriding globals
    Object.entries(data).forEach(([key, value]) => {
        combinedVariables[key.toLowerCase()] = value;
    });
    
    const interpolatedUrl = interpolateString(request.url, combinedVariables);
    const baseUrl = interpolatedUrl.split('?')[0];

    const queryParts: string[] = [];

    request.queryParams
      .filter(p => p.enabled && p.key)
      .forEach(p => {
        const key = interpolateString(p.key, combinedVariables);
        const value = interpolateString(p.value, combinedVariables);
        const encodedKey = encodeURIComponent(key);
        // Default to encoding if the property is not present
        const encodedValue = p.encode !== false ? encodeURIComponent(value) : value;
        queryParts.push(`${encodedKey}=${encodedValue}`);
      });
    
    let authHeaders: KeyValueItem[] = [];
    if (request.auth.type !== 'none') {
        switch (request.auth.type) {
            case 'bearer':
            case 'jwt':
                if (request.auth.token) {
                    const interpolatedToken = interpolateString(request.auth.token, combinedVariables);
                    authHeaders.push({ id: Date.now(), key: 'Authorization', value: `Bearer ${interpolatedToken}`, enabled: true });
                }
                break;
            case 'basic':
                if (request.auth.basicUser || request.auth.basicPass) {
                    const user = interpolateString(request.auth.basicUser || '', combinedVariables);
                    const pass = interpolateString(request.auth.basicPass || '', combinedVariables);
                    authHeaders.push({ id: Date.now(), key: 'Authorization', value: `Basic ${btoa(`${user}:${pass}`)}`, enabled: true });
                }
                break;
            case 'apiKey':
                if (request.auth.apiKeyKey && request.auth.apiKeyValue) {
                    const key = interpolateString(request.auth.apiKeyKey, combinedVariables);
                    const value = interpolateString(request.auth.apiKeyValue, combinedVariables);
                    if (request.auth.apiKeyAddTo === 'header') {
                        authHeaders.push({ id: Date.now(), key, value, enabled: true });
                    } else { // query
                        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                    }
                }
                break;
        }
    }

    const finalSearchString = queryParts.join('&');
    const finalUrl = finalSearchString ? `${baseUrl}?${finalSearchString}` : baseUrl;

    let body: string | FormData | undefined = undefined;
    let bodyHeaders: KeyValueItem[] = [];
    let bodyStructure: KeyValueItem[] | undefined = undefined;

    switch (request.body.type) {
        case 'json':
            body = interpolateString(request.body.jsonBody || '', combinedVariables);
            bodyHeaders.push({id: Date.now(), key: 'Content-Type', value: 'application/json', enabled: true});
            break;
        case 'graphql': {
            const query = request.body.graphqlQuery || '';
            let variables: any = undefined;
            if (request.body.graphqlVariables && request.body.graphqlVariables.trim()) {
                try {
                    variables = JSON.parse(interpolateString(request.body.graphqlVariables, combinedVariables));
                } catch {
                    variables = undefined;
                }
            }
            const payload = { query: interpolateString(query, combinedVariables), variables };
            body = JSON.stringify(payload);
            bodyHeaders.push({id: Date.now(), key: 'Content-Type', value: 'application/json', enabled: true});
            break;
        }
        case 'form-data': {
            const formData = new FormData();
            const items = request.body.formData?.filter(i => i.enabled && i.key) || [];
            items.forEach(item => {
                formData.append(
                    interpolateString(item.key, combinedVariables),
                    interpolateString(item.value, combinedVariables)
                );
            });
            body = formData;
            bodyStructure = items.map(i => ({...i, key: interpolateString(i.key, combinedVariables), value: interpolateString(i.value, combinedVariables) }));
            break;
        }
        case 'x-www-form-urlencoded': {
            const params = new URLSearchParams();
            const items = request.body.urlEncoded?.filter(i => i.enabled && i.key) || [];
            items.forEach(item => {
                params.append(
                    interpolateString(item.key, combinedVariables),
                    interpolateString(item.value, combinedVariables)
                );
            });
            body = params.toString();
            bodyHeaders.push({id: Date.now(), key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true});
            bodyStructure = items.map(i => ({...i, key: interpolateString(i.key, combinedVariables), value: interpolateString(i.value, combinedVariables) }));
            break;
        }
    }
    
    const interpolatedHeaders = request.headers.map(h => ({...h, key: interpolateString(h.key, combinedVariables), value: interpolateString(h.value, combinedVariables) }));
    const finalHeaders = [...bodyHeaders, ...authHeaders, ...interpolatedHeaders];

    return {
        method: request.method,
        url: finalUrl,
        headers: finalHeaders,
        body,
        bodyStructure,
        settings: request.settings,
    };
};