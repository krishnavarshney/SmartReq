import { toJsonObject } from 'curlconverter';
import { ApiRequest, HttpMethod, KeyValueItem } from '../types';

const toItems = (record: Record<string, unknown> | undefined): KeyValueItem[] =>
  Object.entries(record ?? {}).map(([key, value]) => ({
    id: Date.now() + Math.random(),
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    enabled: true,
  }));

export const parseCurl = (curlCommand: string): Partial<ApiRequest> => {
  let parsed: ReturnType<typeof toJsonObject>;
  try {
    parsed = toJsonObject(curlCommand.replace(/\\r?\n/g, ' '));
  } catch {
    throw new Error('Invalid cURL command provided.');
  }

  if (!parsed.url) {
    throw new Error('Could not parse URL from cURL command');
  }

  const data = parsed.data;
  const jsonBody = data === undefined ? '' : typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return {
    method: String(parsed.method || (jsonBody ? 'post' : 'get')).toUpperCase() as HttpMethod,
    url: parsed.url,
    queryParams: toItems(parsed.queries),
    headers: toItems(parsed.headers),
    body: {
      type: jsonBody ? 'json' : 'none',
      jsonBody,
    },
  };
};
