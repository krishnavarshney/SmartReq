import Papa from 'papaparse';
import { ApiRequest, BulkResult, KeyValueItem } from '../../types';

export type DataRow = Record<string, string>;

/* ------------------------------------------------------------------ */
/* Data parsing                                                        */
/* ------------------------------------------------------------------ */

export interface ParseOutcome {
  rows: DataRow[];
  columns: string[];
  format: 'csv' | 'tsv' | 'json';
  /** Fatal problem: nothing could be imported. */
  error?: string;
  /** Non-fatal problems (e.g. ragged CSV rows) worth surfacing. */
  warnings: string[];
}

const cellToString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** Union of keys across all rows, in first-seen order. */
export const collectColumns = (rows: Record<string, unknown>[]): string[] => {
  const seen = new Set<string>();
  const cols: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        cols.push(key);
      }
    }
  }
  return cols;
};

/** Make every row a flat string record with the same set of columns, in column order. */
export const normalizeRows = (rows: Record<string, unknown>[], columns = collectColumns(rows)): DataRow[] =>
  rows.map((row) => {
    const out: DataRow = {};
    for (const col of columns) out[col] = cellToString(row[col]);
    return out;
  });

const parseJson = (text: string): ParseOutcome | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return null;
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch (e) {
    return { rows: [], columns: [], format: 'json', warnings: [], error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  // Accept a bare object as a single row, and { data: [...] } style wrappers.
  if (json && !Array.isArray(json) && typeof json === 'object') {
    // Only unwrap an array of row objects; `{ name: 'a', tags: ['x'] }` is one row, not a wrapper.
    const isRowArray = (v: unknown): v is unknown[] =>
      Array.isArray(v) && v.length > 0 && v.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item));
    const arr = Object.values(json as Record<string, unknown>).find(isRowArray);
    json = arr ?? [json];
  }
  if (!Array.isArray(json)) return { rows: [], columns: [], format: 'json', warnings: [], error: 'JSON must be an array of objects.' };
  const objects = json.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[];
  const skipped = json.length - objects.length;
  if (objects.length === 0) return { rows: [], columns: [], format: 'json', warnings: [], error: 'JSON array contains no objects.' };
  const columns = collectColumns(objects);
  return {
    rows: normalizeRows(objects, columns),
    columns,
    format: 'json',
    warnings: skipped > 0 ? [`Skipped ${skipped} item${skipped === 1 ? '' : 's'} that ${skipped === 1 ? 'is' : 'are'} not an object.`] : [],
  };
};

const parseDelimited = (text: string): ParseOutcome => {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h, i) => h.trim() || `column_${i + 1}`,
  });
  const format = result.meta.delimiter === '\t' ? 'tsv' : 'csv';
  const columns = (result.meta.fields ?? []).filter((f) => f !== '__parsed_extra');
  if (columns.length === 0) return { rows: [], columns: [], format, warnings: [], error: 'No header row found. The first line must contain column names.' };
  const rows = normalizeRows(result.data, columns);
  const warnings: string[] = [];
  const rowErrors = result.errors.filter((e) => e.type !== 'Delimiter');
  if (rowErrors.length > 0) {
    const sample = rowErrors
      .slice(0, 3)
      .map((e) => (typeof e.row === 'number' ? `row ${e.row + 1}: ${e.message}` : e.message))
      .join('; ');
    warnings.push(`${rowErrors.length} row${rowErrors.length === 1 ? '' : 's'} had problems (${sample}${rowErrors.length > 3 ? '; ...' : ''}).`);
  }
  if (rows.length === 0) return { rows, columns, format, warnings, error: 'Found a header row but no data rows.' };
  return { rows, columns, format, warnings };
};

/** Parse pasted or uploaded text as JSON (array of objects) or CSV/TSV with a header row. */
export const parseTabularText = (text: string): ParseOutcome => {
  if (!text.trim()) return { rows: [], columns: [], format: 'csv', warnings: [], error: 'Nothing to import.' };
  return parseJson(text) ?? parseDelimited(text);
};

export const rowsToCsv = (rows: DataRow[], columns: string[]): string => Papa.unparse({ fields: columns, data: rows.map((r) => columns.map((c) => r[c] ?? '')) });

/* ------------------------------------------------------------------ */
/* Template variables                                                  */
/* ------------------------------------------------------------------ */

export type VariableLocation = 'URL' | 'Params' | 'Headers' | 'Auth' | 'Body';

export interface TemplateVariable {
  /** Name as written in the template (trimmed). */
  name: string;
  /** Lowercased key used for resolution (interpolation is case-insensitive). */
  key: string;
  locations: VariableLocation[];
}

const VAR_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

const enabledPairs = (items?: KeyValueItem[]) => (items ?? []).filter((i) => i.enabled && (i.key || i.value)).flatMap((i) => [i.key, i.value]);

/** Every {{variable}} the request will interpolate, with where it appears. */
export const extractTemplateVariables = (request: ApiRequest): TemplateVariable[] => {
  const found = new Map<string, TemplateVariable>();
  const scan = (text: string | undefined, location: VariableLocation) => {
    if (!text) return;
    for (const match of text.matchAll(VAR_RE)) {
      const name = match[1].trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = found.get(key) ?? { name, key, locations: [] };
      if (!entry.locations.includes(location)) entry.locations.push(location);
      found.set(key, entry);
    }
  };

  scan(request.url, 'URL');
  enabledPairs(request.queryParams).forEach((t) => scan(t, 'Params'));
  enabledPairs(request.headers).forEach((t) => scan(t, 'Headers'));
  enabledPairs(request.pathVariables).forEach((t) => scan(t, 'URL'));

  const { auth } = request;
  if (auth.type === 'bearer' || auth.type === 'jwt') scan(auth.token, 'Auth');
  if (auth.type === 'basic') [auth.basicUser, auth.basicPass].forEach((t) => scan(t, 'Auth'));
  if (auth.type === 'apiKey') [auth.apiKeyKey, auth.apiKeyValue].forEach((t) => scan(t, 'Auth'));
  if (auth.type === 'oauth2') scan(auth.oauth2?.accessToken, 'Auth');

  const { body } = request;
  if (body.type === 'json') scan(body.jsonBody, 'Body');
  if (body.type === 'raw') scan(body.rawBody, 'Body');
  if (body.type === 'graphql') [body.graphqlQuery, body.graphqlVariables].forEach((t) => scan(t, 'Body'));
  if (body.type === 'form-data') enabledPairs(body.formData).forEach((t) => scan(t, 'Body'));
  if (body.type === 'x-www-form-urlencoded') enabledPairs(body.urlEncoded).forEach((t) => scan(t, 'Body'));

  return Array.from(found.values());
};

export interface VariableCheck {
  variables: TemplateVariable[];
  /** Resolved from a data column. */
  fromData: TemplateVariable[];
  /** Resolved from globals / active environment only. */
  fromGlobals: TemplateVariable[];
  /** Not resolvable: will be sent literally as {{name}}. */
  missing: TemplateVariable[];
  /** Data columns referenced by the template (lowercased). */
  usedColumns: Set<string>;
  /** Per variable key: number of rows whose value is empty. */
  emptyCounts: Map<string, number>;
}

export const checkTemplateVariables = (request: ApiRequest, columns: string[], rows: DataRow[], globals: KeyValueItem[]): VariableCheck => {
  const variables = extractTemplateVariables(request);
  const columnByKey = new Map(columns.map((c) => [c.toLowerCase(), c]));
  const globalKeys = new Set(globals.filter((g) => g.enabled && g.key).map((g) => g.key.toLowerCase()));
  const fromData: TemplateVariable[] = [];
  const fromGlobals: TemplateVariable[] = [];
  const missing: TemplateVariable[] = [];
  const usedColumns = new Set<string>();
  const emptyCounts = new Map<string, number>();

  for (const v of variables) {
    const col = columnByKey.get(v.key);
    if (col !== undefined) {
      fromData.push(v);
      usedColumns.add(v.key);
      let empty = 0;
      for (const row of rows) if (!row[col]) empty++;
      if (empty > 0) emptyCounts.set(v.key, empty);
    } else if (globalKeys.has(v.key)) {
      fromGlobals.push(v);
    } else {
      missing.push(v);
    }
  }
  return { variables, fromData, fromGlobals, missing, usedColumns, emptyCounts };
};

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

export const isSettled = (r: BulkResult) => r.status === 'success' || r.status === 'error';

/** Nearest-rank percentile of an ascending-sorted array. */
export const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
};

export interface ResultStats {
  total: number;
  pending: number;
  running: number;
  success: number;
  error: number;
  cancelled: number;
  settled: number;
  durations: number[];
  p50: number;
  p95: number;
  avg: number;
  min: number;
  max: number;
  totalBytes: number;
}

export const computeStats = (results: BulkResult[]): ResultStats => {
  const s = { total: results.length, pending: 0, running: 0, success: 0, error: 0, cancelled: 0 };
  const durations: number[] = [];
  let totalBytes = 0;
  for (const r of results) {
    s[r.status] += 1;
    if (isSettled(r)) {
      // status 0 = never got a response; its duration is time-to-failure, not latency.
      if (r.response.status > 0 && typeof r.response.duration === 'number') durations.push(r.response.duration);
      totalBytes += r.response.size?.total ?? 0;
    }
  }
  durations.sort((a, b) => a - b);
  const sum = durations.reduce((a, b) => a + b, 0);
  return {
    ...s,
    settled: s.success + s.error,
    durations,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    avg: durations.length ? sum / durations.length : 0,
    min: durations[0] ?? 0,
    max: durations[durations.length - 1] ?? 0,
    totalBytes,
  };
};

export const statusLabel = (r: BulkResult): string => {
  if (r.response.status > 0) return `${r.response.status}${r.response.statusText ? ` ${r.response.statusText}` : ''}`;
  return r.response.statusText || '';
};

export const flattenObject = (obj: unknown, prefix: string, out: Record<string, unknown> = {}): Record<string, unknown> => {
  if (obj === null || typeof obj !== 'object') {
    out[prefix] = obj;
    return out;
  }
  const entries = Array.isArray(obj) ? obj.map((v, i) => [String(i), v] as const) : Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) out[prefix] = Array.isArray(obj) ? '[]' : '{}';
  for (const [key, value] of entries) flattenObject(value, `${prefix}.${key}`, out);
  return out;
};

/** One flat record per result: source data, outcome, and the response body expanded into columns. */
export const flattenResultsForExport = (results: BulkResult[]): Record<string, unknown>[] =>
  results.map((r) => {
    const body = r.response.body;
    let bodyColumns: Record<string, unknown>;
    if (body !== null && typeof body === 'object') bodyColumns = flattenObject(body, 'body');
    else if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        bodyColumns = parsed && typeof parsed === 'object' ? flattenObject(parsed, 'body') : { body };
      } catch {
        bodyColumns = { body };
      }
    } else bodyColumns = { body: body ?? '' };

    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r.data)) data[`data.${k}`] = v;

    return {
      row: r.id,
      result: r.status,
      ...data,
      method: r.request?.method ?? '',
      url: r.request?.url ?? '',
      status_code: r.response.status || '',
      status_text: r.response.statusText,
      duration_ms: isSettled(r) ? r.response.duration : '',
      size_bytes: r.response.size?.total ?? '',
      ...bodyColumns,
    };
  });

export const formatMs = (ms: number): string => {
  if (!Number.isFinite(ms)) return '-';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
};

export const formatClock = (totalMs: number): string => {
  const total = Math.max(0, Math.round(totalMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

/** Download rows as a CSV file (columns = union of keys in first-seen order). */
export const downloadCsv = (rows: Record<string, unknown>[], filename: string) => {
  const columns = collectColumns(rows);
  const csv = Papa.unparse({ fields: columns, data: rows.map((r) => columns.map((c) => cellToString(r[c]))) });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
