import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';
import { DiscoveredEndpoint, HttpMethod } from '../types';
import { realApiCall } from '../api';
import { getApiKey } from './apiKey';

const COMMON_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

async function extractLinksFromResponse(ai: GoogleGenAI, responseBody: string): Promise<string[]> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this JSON response. Extract any strings that look like relative or absolute API paths or endpoints. Only include paths that are likely to be API endpoints, not static assets like images. Return a JSON array of strings. For example: ["/users/123", "/products?page=2"]. If none are found, return an empty array. JSON response: \`\`\`json\n${responseBody}\n\`\`\``,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING
                }
              }
            }
        });

        const jsonString = (response.text ?? '').trim();
        const links = JSON.parse(jsonString);
        return Array.isArray(links) ? links.filter(l => typeof l === 'string') : [];
    } catch (error) {
        console.error("AI link extraction failed:", error);
        return [];
    }
}

async function generateOpenApiSpec(ai: GoogleGenAI, endpoints: DiscoveredEndpoint[]): Promise<string> {
    const simplifiedEndpoints = endpoints.map(ep => ({
        method: ep.method,
        path: new URL(ep.url).pathname,
        response_status: ep.response?.status,
        response_body_snippet: JSON.stringify(ep.response?.body, null, 2).substring(0, 500),
    }));

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Based on this list of discovered API endpoints and example responses, generate a basic OpenAPI 3.0 specification in YAML format. Make educated guesses about path parameters (e.g., '/users/123' -> '/users/{id}'), query parameters, and data schemas based on the response bodies. Keep it concise. Endpoints: \`\`\`json\n${JSON.stringify(simplifiedEndpoints, null, 2)}\n\`\`\``,
    });
    
    return (response.text ?? '').replace(/```yaml|```/g, '').trim();
}


export async function* startDiscovery(
    baseUrl: string,
    signal: AbortSignal
): AsyncGenerator<{
    log: string[];
    endpoints?: DiscoveredEndpoint[];
    generatedSpec?: string;
}> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API key is not configured. Add it in Settings.");

    const ai = new GoogleGenAI({ apiKey });
    const queue: string[] = ['/'];
    const visited = new Set<string>();
    let discoveredEndpoints: DiscoveredEndpoint[] = [];

    while (queue.length > 0) {
        if (signal.aborted) throw new Error("Discovery aborted by user.");

        const path = queue.shift()!;
        if (visited.has(path)) continue;
        
        visited.add(path);
        const url = new URL(path, baseUrl).toString();

        yield { log: [`[API] Testing endpoint: GET ${url}`] };

        const response = await realApiCall({
            method: 'GET',
            url: url,
            headers: [{ id: 1, key: 'Accept', value: 'application/json', enabled: true }],
            body: undefined,
            settings: { followRedirects: true, sslVerification: true },
        });

        if (signal.aborted) throw new Error("Discovery aborted by user.");

        if (response.status >= 200 && response.status < 300) {
            const newEndpoint: DiscoveredEndpoint = {
                id: uuidv4(),
                method: 'GET',
                url,
                status: 'tested',
                response
            };
            discoveredEndpoints = [...discoveredEndpoints, newEndpoint];
            yield { log: [`[OK] Found GET ${path} (Status: ${response.status})`], endpoints: discoveredEndpoints };

            const bodyString = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
            if (bodyString) {
                yield { log: [`[AI] Analyzing response from GET ${path} for new links...`] };
                const newLinks = await extractLinksFromResponse(ai, bodyString);
                yield { log: [`[AI] Found ${newLinks.length} potential new links.`] };
                for (const link of newLinks) {
                    if (!visited.has(link) && !queue.includes(link)) {
                        queue.push(link);
                    }
                }
            }
        } else {
             yield { log: [`[WARN] GET ${path} returned status ${response.status}`] };
        }
    }
    
    yield { log: [`[AI] All paths explored. Generating OpenAPI specification...`] };
    const spec = await generateOpenApiSpec(ai, discoveredEndpoints);
    yield { log: [`[OK] Specification generated.`], generatedSpec: spec };
}