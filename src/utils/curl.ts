import { toJavaScript } from 'curlconverter';
import { ApiRequest, KeyValueItem } from '../types';

export const parseCurl = (curlCommand: string): Partial<ApiRequest> => {
  try {
    // Pre-process the curl command to handle line continuations (\n or \r\n)
    const singleLineCommand = curlCommand.replace(/\\r?\n/g, ' ');
    const jsCode = toJavaScript(singleLineCommand);
    
    const urlMatch = jsCode.match(/fetch\((['"])(.*?)\1/);
    // Simplified regex to avoid parsing issues
    const optionsMatch = jsCode.match(/fetch\([^,]+,\s*(\{.*\})\)/s);

    if (!urlMatch) {
      throw new Error('Could not parse URL from cURL command');
    }

    const url = urlMatch[2];
    let options = {};
    if (optionsMatch) {
      try {
        options = eval('(' + optionsMatch[1] + ')');
      } catch (e) {
        console.error("Failed to parse fetch options:", e);
      }
    }
    
    const { method, headers, body } = options as any;

    const sanitizedBody = body ? String(body).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim() : '';

    const queryParams: KeyValueItem[] = [];
    const urlObject = new URL(url);
    urlObject.searchParams.forEach((value, key) => {
      queryParams.push({
        id: Date.now() + Math.random(),
        key,
        value,
        enabled: true,
      });
    });

    const headerItems: KeyValueItem[] = Object.entries(headers || {}).map(([key, value]) => ({
      id: Date.now() + Math.random(),
      key,
      value: value as string,
      enabled: true,
    }));

    return {
      method: method || (body ? 'POST' : 'GET'),
      url: url.split('?')[0],
      queryParams,
      headers: headerItems,
      body: {
        type: sanitizedBody ? 'json' : 'none',
        jsonBody: sanitizedBody ? JSON.stringify(JSON.parse(sanitizedBody), null, 2) : '',
      },
    };
  } catch (error) {
    console.error('Failed to parse cURL command:', error);
    throw new Error('Invalid cURL command provided.');
  }
};