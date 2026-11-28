import { describe, expect, it } from 'vitest';
import { checkTemplateVariables, computeStats, flattenResultsForExport, parseTabularText, percentile } from './bulkUtils';
import { createDefaultRequest } from '../../utils/collection';
import { BulkResult } from '../../types';

describe('parseTabularText', () => {
  it('parses CSV with a header row', () => {
    const out = parseTabularText('id,name\n1,Ada\n2,Grace\n');
    expect(out.error).toBeUndefined();
    expect(out.columns).toEqual(['id', 'name']);
    expect(out.rows).toEqual([{ id: '1', name: 'Ada' }, { id: '2', name: 'Grace' }]);
  });

  it('parses TSV pasted from a spreadsheet', () => {
    const out = parseTabularText('id\tname\n1\tAda');
    expect(out.format).toBe('tsv');
    expect(out.rows[0]).toEqual({ id: '1', name: 'Ada' });
  });

  it('normalizes JSON rows: union of keys, objects stringified', () => {
    const out = parseTabularText('[{"a":1},{"b":{"c":true}}]');
    expect(out.columns).toEqual(['a', 'b']);
    expect(out.rows).toEqual([{ a: '1', b: '' }, { a: '', b: '{"c":true}' }]);
  });

  it('reports invalid JSON and header-only CSV as errors', () => {
    expect(parseTabularText('[{"a":').error).toMatch(/Invalid JSON/);
    expect(parseTabularText('id,name').error).toMatch(/no data rows/);
  });
});

describe('checkTemplateVariables', () => {
  it('classifies variables as data, globals or missing (case-insensitive)', () => {
    const req = createDefaultRequest();
    req.url = 'https://api.test/{{ ID }}/{{host}}';
    req.headers = [{ id: 1, key: 'X-Trace', value: '{{trace}}', enabled: true }];
    const check = checkTemplateVariables(req, ['id'], [{ id: '1' }, { id: '' }], [{ id: 1, key: 'HOST', value: 'h', enabled: true }]);
    expect(check.fromData.map((v) => v.key)).toEqual(['id']);
    expect(check.fromGlobals.map((v) => v.key)).toEqual(['host']);
    expect(check.missing.map((v) => v.name)).toEqual(['trace']);
    expect(check.emptyCounts.get('id')).toBe(1);
  });
});

describe('stats and export', () => {
  const mk = (id: number, status: BulkResult['status'], code: number, duration: number): BulkResult => ({
    id,
    data: { id: String(id) },
    request: { method: 'GET', url: `http://x/${id}`, headers: [], body: undefined, settings: { sslVerification: true, followRedirects: true } },
    response: { status: code, statusText: '', headers: {}, body: { user: { name: 'a' }, tags: ['x'] }, duration },
    status,
  });

  it('computes nearest-rank percentiles over responses only', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    const stats = computeStats([mk(1, 'success', 200, 10), mk(2, 'error', 500, 30), mk(3, 'error', 0, 999), mk(4, 'cancelled', 0, 0)]);
    expect(stats.success).toBe(1);
    expect(stats.error).toBe(2);
    expect(stats.cancelled).toBe(1);
    expect(stats.durations).toEqual([10, 30]);
    expect(stats.p95).toBe(30);
  });

  it('flattens nested response bodies into columns', () => {
    const [row] = flattenResultsForExport([mk(1, 'success', 200, 10)]);
    expect(row['body.user.name']).toBe('a');
    expect(row['body.tags.0']).toBe('x');
    expect(row['data.id']).toBe('1');
  });
});

describe('review fixes', () => {
  it('treats a single object with a primitive array field as one row', () => {
    const out = parseTabularText('{"name":"a","tags":["x","y"]}');
    expect(out.error).toBeUndefined();
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].name).toBe('a');
  });

  it('still unwraps { data: [...] } wrappers', () => {
    expect(parseTabularText('{"data":[{"id":1},{"id":2}]}').rows).toHaveLength(2);
  });

  it('finds variables in raw bodies', () => {
    const req = createDefaultRequest();
    req.body = { type: 'raw', rawBody: '<id>{{id}}</id>', rawContentType: 'application/xml' };
    const check = checkTemplateVariables(req, ['id'], [{ id: '1' }], []);
    expect(check.usedColumns.has('id')).toBe(true);
  });
});
