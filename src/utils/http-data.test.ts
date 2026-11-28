import { describe, it, expect } from 'vitest';
import {
  applyPathVariables,
  extractPathVariableNames,
  extractVariableNames,
  formatJsonTemplate,
  isForbiddenHeader,
  parseQueryString,
  serializeQuery,
  splitUrl,
  syncPathVariables,
  validateJsonTemplate,
} from './http-data';

describe('query helpers', () => {
  it('splits a URL into base, query and hash', () => {
    expect(splitUrl('https://a.b/x?y=1&z#top')).toEqual({ base: 'https://a.b/x', query: 'y=1&z', hash: '#top' });
    expect(splitUrl('{{base}}/x')).toEqual({ base: '{{base}}/x', query: '', hash: '' });
  });

  it('parses without throwing and keeps variables', () => {
    expect(parseQueryString('a=1&b&c=%41&d=50%&e={{tok}}')).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '' },
      { key: 'c', value: 'A' },
      { key: 'd', value: '50%' },
      { key: 'e', value: '{{tok}}' },
    ]);
  });

  it('round-trips structural characters', () => {
    const params = [
      { key: 'q', value: 'a&b#c' },
      { key: 'k=1', value: '{{v}}' },
    ];
    expect(parseQueryString(serializeQuery(params))).toEqual(params);
    expect(serializeQuery(params)).toContain('{{v}}');
  });
});

describe('path variables', () => {
  it('finds :params in the path but not ports or query', () => {
    expect(extractPathVariableNames('http://localhost:4010/users/:id/posts/:postId?x=:y')).toEqual(['id', 'postId']);
    expect(extractPathVariableNames('{{baseUrl}}/users/:id')).toEqual(['id']);
  });

  it('applies values with encoding and leaves empty ones', () => {
    expect(applyPathVariables('http://h:1/u/:id/:other?q=1', { id: 'a b' })).toBe('http://h:1/u/a%20b/:other?q=1');
  });

  it('syncs rows with the URL, keeping values', () => {
    const rows = syncPathVariables('/u/:id/:b', [{ id: 1, key: 'id', value: '7', enabled: true }]);
    expect(rows.map((r) => [r.key, r.value])).toEqual([
      ['id', '7'],
      ['b', ''],
    ]);
  });
});

describe('json templates', () => {
  it('accepts unquoted variables', () => {
    expect(validateJsonTemplate('{"id": {{id}}, "name": "{{name}}"}')).toBeNull();
    expect(validateJsonTemplate('{"id": }')).not.toBeNull();
    expect(validateJsonTemplate('  ')).toBeNull();
  });

  it('formats without losing variables', () => {
    expect(formatJsonTemplate('{"id":{{id}},"n":"{{ name }}"}')).toBe('{\n  "id": {{id}},\n  "n": "{{ name }}"\n}');
  });

  it('lists variable names', () => {
    expect(extractVariableNames('{{a}}/x/{{ b }}/{{a}}')).toEqual(['a', 'b']);
  });
});

describe('forbidden headers', () => {
  it('flags browser-controlled headers', () => {
    expect(isForbiddenHeader('Host')).toBe(true);
    expect(isForbiddenHeader('sec-fetch-mode')).toBe(true);
    expect(isForbiddenHeader('Authorization')).toBe(false);
  });
});
