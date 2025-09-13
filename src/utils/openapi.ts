import SwaggerParser from '@apidevtools/swagger-parser';
import { v4 as uuidv4 } from 'uuid';
import { Collection, RequestNode, HttpMethod, KeyValueItem, ApiRequest } from '../types';
import { createDefaultRequest } from './collection';

// Helper to generate a dummy value based on schema type
const generateValueFromSchema = (schema: any): any => {
    if (!schema) return '';
    if (schema.example) return schema.example;
    if (schema.default) return schema.default;

    switch (schema.type) {
        case 'string':
            if (schema.format === 'date-time') return new Date().toISOString();
            if (schema.format === 'email') return 'user@example.com';
            return 'string';
        case 'number':
        case 'integer':
            return 0;
        case 'boolean':
            return false;
        case 'object':
            const obj: { [key: string]: any } = {};
            if (schema.properties) {
                for (const prop in schema.properties) {
                    obj[prop] = generateValueFromSchema(schema.properties[prop]);
                }
            }
            return obj;
        case 'array':
            return schema.items ? [generateValueFromSchema(schema.items)] : [];
        default:
            return '';
    }
}

export const parseOpenApiSpec = async (source: string | File): Promise<Collection> => {
    try {
        // Use 'any' type to handle both OpenAPI v2 and v3 without type conflicts
        const api: any = await SwaggerParser.bundle(source instanceof File ? URL.createObjectURL(source) : source);

        const collection: Collection = {
            id: uuidv4(),
            type: 'collection',
            name: api.info.title,
            children: [],
        };
        
        let baseUrl = '';
        if (api.servers && api.servers.length > 0) {
            baseUrl = api.servers[0].url;
        } else if (api.host) {
            const scheme = api.schemes?.[0] || 'https';
            baseUrl = `${scheme}://${api.host}${api.basePath || ''}`;
        }
        // Remove trailing slash
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }

        for (const path in api.paths) {
            const pathItem = api.paths[path];
            if (!pathItem) continue;

            for (const method in pathItem) {
                // Skip non-HTTP methods
                if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method.toLowerCase())) {
                    continue;
                }
                
                const operation = pathItem[method as keyof typeof pathItem];
                if (!operation || typeof operation !== 'object' || Array.isArray(operation)) continue;
                
                const defaultReq = createDefaultRequest();
                const request: ApiRequest = {
                    ...defaultReq,
                    method: method.toUpperCase() as HttpMethod,
                    url: `${baseUrl}${path}`,
                    queryParams: (operation.parameters || [])
                        .filter((p: any) => p.in === 'query')
                        .map((p: any) => ({
                            id: Date.now() + Math.random(),
                            key: p.name,
                            value: String(p.schema?.default || p.example || ''),
                            enabled: true,
                        })),
                    headers: (operation.parameters || [])
                        .filter((p: any) => p.in === 'header')
                        .map((p: any) => ({
                            id: Date.now() + Math.random(),
                            key: p.name,
                            value: String(p.schema?.default || p.example || ''),
                            enabled: true,
                        })),
                };
                
                const jsonBodySchema = operation.requestBody?.content?.['application/json']?.schema;
                if (jsonBodySchema) {
                    request.body.type = 'json';
                    const exampleBody = generateValueFromSchema(jsonBodySchema);
                    request.body.jsonBody = JSON.stringify(exampleBody, null, 2);
                }

                collection.children.push({
                    id: uuidv4(),
                    type: 'request',
                    name: operation.summary || `${method.toUpperCase()} ${path}`,
                    request,
                    responses: [],
                });
            }
        }

        return collection;
    } catch (err: any) {
        console.error('OpenAPI parsing error:', err);
        throw new Error(err.message || 'Failed to parse the OpenAPI/Swagger specification.');
    }
};
