import { ApiRequest, KeyValueItem } from '../types';
import { interpolateString } from './interpolation';

export const buildHarRequest = (request: ApiRequest, globals: KeyValueItem[]): any => {
    // --- Variable Setup ---
    const combinedVariables: Record<string, string> = {};
    globals.filter(g => g.enabled && g.key).forEach(g => {
        combinedVariables[g.key.toLowerCase()] = g.value;
    });

    // --- URL and Query String ---
    const interpolatedUrl = interpolateString(request.url, combinedVariables);
    const baseUrl = interpolatedUrl.split('?')[0];

    const harQueryString = request.queryParams
        .filter(p => p.enabled)
        .map(p => ({
            name: interpolateString(p.key, combinedVariables).trim(),
            value: interpolateString(p.value, combinedVariables),
        }))
        .filter(p => p.name); // Filter out empty names

    if (request.auth.type === 'apiKey' && request.auth.apiKeyAddTo === 'query' && request.auth.apiKeyKey) {
        const name = interpolateString(request.auth.apiKeyKey, combinedVariables).trim();
        if (name) {
            harQueryString.push({
                name,
                value: interpolateString(request.auth.apiKeyValue || '', combinedVariables),
            });
        }
    }
    
    const finalUrlSearchParams = new URLSearchParams();
    harQueryString.forEach(p => finalUrlSearchParams.append(p.name, p.value));
    const searchString = finalUrlSearchParams.toString();
    const finalUrl = searchString ? `${baseUrl}?${searchString}` : baseUrl;
    
    // --- Headers ---
    const headerMap = new Map<string, string>();

    if (request.body.type === 'json' && request.body.jsonBody) {
        headerMap.set('content-type', 'application/json');
    } else if (request.body.type === 'x-www-form-urlencoded') {
        headerMap.set('content-type', 'application/x-www-form-urlencoded');
    }

    switch (request.auth.type) {
        case 'bearer':
        case 'jwt':
            if (request.auth.token) headerMap.set('authorization', `Bearer ${interpolateString(request.auth.token, combinedVariables)}`);
            break;
        case 'basic':
            const user = interpolateString(request.auth.basicUser || '', combinedVariables);
            const pass = interpolateString(request.auth.basicPass || '', combinedVariables);
            headerMap.set('authorization', `Basic ${btoa(`${user}:${pass}`)}`);
            break;
        case 'apiKey':
            if (request.auth.apiKeyAddTo === 'header' && request.auth.apiKeyKey) {
                const name = interpolateString(request.auth.apiKeyKey, combinedVariables).trim();
                if (name) headerMap.set(name.toLowerCase(), interpolateString(request.auth.apiKeyValue || '', combinedVariables));
            }
            break;
    }

    request.headers
        .filter(h => h.enabled)
        .forEach(h => {
            const name = interpolateString(h.key, combinedVariables).trim();
            if (name) headerMap.set(name.toLowerCase(), interpolateString(h.value, combinedVariables));
        });

    const harHeaders = Array.from(headerMap, ([name, value]) => ({ name, value }));

    // --- Body ---
    const postData: any = {};
    switch (request.body.type) {
        case 'json':
            if (request.body.jsonBody) {
                postData.mimeType = 'application/json';
                postData.text = interpolateString(request.body.jsonBody, combinedVariables);
            }
            break;
        case 'form-data':
            postData.mimeType = 'multipart/form-data';
            postData.params = (request.body.formData || [])
                .filter(p => p.enabled)
                .map(p => ({
                    name: interpolateString(p.key, combinedVariables).trim(),
                    value: interpolateString(p.value, combinedVariables),
                }))
                .filter(p => p.name);
            break;
        case 'x-www-form-urlencoded':
            postData.mimeType = 'application/x-www-form-urlencoded';
            postData.params = (request.body.urlEncoded || [])
                .filter(p => p.enabled)
                .map(p => ({
                    name: interpolateString(p.key, combinedVariables).trim(),
                    value: interpolateString(p.value, combinedVariables),
                }))
                .filter(p => p.name);
            break;
    }

    return {
        method: request.method.toUpperCase(),
        url: finalUrl,
        queryString: harQueryString,
        headers: harHeaders,
        postData: Object.keys(postData).length > 0 ? postData : undefined,
    };
};