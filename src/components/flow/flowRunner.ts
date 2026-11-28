import { ApiRequest, ApiResponse, FinalApiRequest, KeyValueItem, VariableExtraction } from '../../types';
import { buildFinalRequest, realApiCall } from '../../api';
import { runTestScript } from '../../utils/scripting';

export type StepRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'cancelled';
export type FlowRunStatus = 'running' | 'passed' | 'failed' | 'stopped';

export interface StepRun {
  nodeId: string;
  status: StepRunStatus;
  startedAt?: number;
  duration?: number;
  request?: FinalApiRequest;
  response?: ApiResponse;
  /** Variables this step extracted from its response. */
  extracted: Record<string, string>;
  /** Non-fatal problems: unresolved variables, extractions that matched nothing. */
  warnings: string[];
  /** Why the step failed (when status is failed). */
  error?: string;
}

export interface FlowRun {
  id: string;
  flowId: string;
  status: FlowRunStatus;
  startedAt: number;
  finishedAt?: number;
  steps: StepRun[];
  /** All variables extracted so far, in step order. */
  variables: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* Path lookup                                                         */
/* ------------------------------------------------------------------ */

/**
 * Split a JSONPath-ish expression into segments.
 * Accepts `data.items[0].id`, `$.data.items.0.id`, `['odd key'].x`, `[0]`.
 */
export const parsePath = (path: string): string[] => {
  let p = path.trim();
  if (p.startsWith('$')) p = p.slice(1);
  const segments: string[] = [];
  const re = /\[\s*(?:'([^']*)'|"([^"]*)"|(\d+))\s*\]|([^.[\]]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p)) !== null) {
    const seg = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (seg !== undefined && seg !== '') segments.push(seg);
  }
  return segments;
};

export const getValueAtPath = (root: unknown, path: string): { found: boolean; value: unknown } => {
  const segments = parsePath(path);
  let current: unknown = root;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== 'object') return { found: false, value: undefined };
    if (Array.isArray(current)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx)) return { found: false, value: undefined };
      const i = idx < 0 ? current.length + idx : idx;
      if (i < 0 || i >= current.length) return { found: false, value: undefined };
      current = current[i];
    } else {
      if (!Object.prototype.hasOwnProperty.call(current, seg)) return { found: false, value: undefined };
      current = (current as Record<string, unknown>)[seg];
    }
  }
  return { found: true, value: current };
};

export const stringifyValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/** Response body as a JS value: JSON strings are parsed, everything else is returned as is. */
export const parseBody = (body: unknown): unknown => {
  if (typeof body !== 'string') return body;
  const t = body.trim();
  if (!t || (t[0] !== '{' && t[0] !== '[')) return body;
  try {
    return JSON.parse(t);
  } catch {
    return body;
  }
};

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

export const extractVariables = (
  extractions: VariableExtraction[],
  response: ApiResponse
): { values: Record<string, string>; warnings: string[] } => {
  const values: Record<string, string> = {};
  const warnings: string[] = [];
  const body = parseBody(response.body);
  for (const ex of extractions) {
    const name = ex.name.trim();
    if (!name) continue;
    if (ex.source === 'HEADER') {
      const header = ex.path.trim().toLowerCase();
      const value = response.headers[header];
      if (value === undefined) warnings.push(`"${name}": response has no "${ex.path.trim()}" header`);
      else values[name] = value;
    } else {
      const { found, value } = getValueAtPath(body, ex.path);
      if (!found) warnings.push(`"${name}": nothing found at body path "${ex.path.trim() || '(root)'}"`);
      else values[name] = stringifyValue(value);
    }
  }
  return { values, warnings };
};

/* ------------------------------------------------------------------ */
/* Step references: {{steps.1.body.id}}                                */
/* ------------------------------------------------------------------ */

const STEP_REF = /\{\{\s*(steps\.\d+(?:[.[][^}]*)?)\s*\}\}/gi;

export const collectStepRefs = (text: string): string[] => {
  const refs = new Set<string>();
  for (const m of text.matchAll(STEP_REF)) refs.add(m[1].trim());
  return [...refs];
};

/**
 * Resolve `steps.N.<field>[.path]` against earlier step runs (N is 1-based).
 * Fields: status, statusText, duration, body[.path], headers.<name>.
 */
export const resolveStepRef = (ref: string, previous: StepRun[]): { ok: true; value: string } | { ok: false; reason: string } => {
  const m = /^steps\.(\d+)(?:\.(\w+))?(.*)$/i.exec(ref);
  if (!m) return { ok: false, reason: `{{${ref}}} is not a valid step reference` };
  const n = Number(m[1]);
  const run = previous[n - 1];
  if (!run) return { ok: false, reason: `{{${ref}}}: step ${n} has not run before this step` };
  if (!run.response) return { ok: false, reason: `{{${ref}}}: step ${n} has no response` };
  const field = (m[2] || 'body').toLowerCase();
  const rest = m[3].replace(/^\./, '');
  const res = run.response;
  switch (field) {
    case 'status':
      return { ok: true, value: String(res.status) };
    case 'statustext':
      return { ok: true, value: res.statusText };
    case 'duration':
      return { ok: true, value: String(res.duration) };
    case 'headers': {
      const value = res.headers[rest.toLowerCase()];
      return value === undefined ? { ok: false, reason: `{{${ref}}}: step ${n} has no "${rest}" header` } : { ok: true, value };
    }
    case 'body': {
      const { found, value } = getValueAtPath(parseBody(res.body), rest);
      return found ? { ok: true, value: stringifyValue(value) } : { ok: false, reason: `{{${ref}}}: nothing at "${rest || '(root)'}" in step ${n}'s body` };
    }
    default:
      return { ok: false, reason: `{{${ref}}}: unknown field "${m[2]}" (use status, headers or body)` };
  }
};

/** Variables to interpolate into a step: extracted flow variables plus any step references it uses. */
export const buildStepData = (
  request: ApiRequest,
  previous: StepRun[],
  flowVariables: Record<string, string>
): { data: Record<string, string>; warnings: string[] } => {
  const data: Record<string, string> = { ...flowVariables };
  const warnings: string[] = [];
  // Walk the raw string fields: JSON.stringify would escape `"` and break refs like {{steps.1.body["user id"]}}.
  const strings: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(request);
  for (const ref of collectStepRefs(strings.join('\n'))) {
    const r = resolveStepRef(ref, previous);
    if (r.ok) data[ref] = r.value;
    else warnings.push(r.reason);
  }
  return { data, warnings };
};

/** `{{tokens}}` left in the final request after interpolation. */
export const findUnresolved = (req: FinalApiRequest): string[] => {
  let url = req.url;
  try {
    url = decodeURIComponent(req.url);
  } catch {
    /* malformed escape: scan the raw URL */
  }
  const parts = [url, ...req.headers.filter((h) => h.enabled).flatMap((h) => [h.key, h.value])];
  if (typeof req.body === 'string') parts.push(req.body);
  const found = new Set<string>();
  for (const part of parts) for (const m of part.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) found.add(m[1]);
  return [...found];
};

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

const byteLength = (s: string) => new TextEncoder().encode(s).length;

export class StepCancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'AbortError';
  }
}

/** Build, send and test one step. Rejects with StepCancelledError if `signal` aborts first. */
export const executeStep = async (
  request: ApiRequest,
  data: Record<string, string>,
  env: KeyValueItem[],
  signal: AbortSignal
): Promise<{ request: FinalApiRequest; response: ApiResponse }> => {
  const finalRequest = buildFinalRequest(request, data, env);
  const headerBytes = byteLength(
    finalRequest.headers
      .filter((h) => h.enabled)
      .map((h) => `${h.key}: ${h.value}`)
      .join('\n')
  );
  const bodyBytes = typeof finalRequest.body === 'string' ? byteLength(finalRequest.body) : 0;
  finalRequest.size = { headers: headerBytes, body: bodyBytes, total: headerBytes + bodyBytes };

  if (signal.aborted) throw new StepCancelledError();
  // The signal cancels the fetch; racing it as well makes Stop take effect immediately.
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new StepCancelledError());
    signal.addEventListener('abort', onAbort, { once: true });
  });
  let response: ApiResponse;
  try {
    response = await Promise.race([realApiCall(finalRequest, { signal }), aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }

  if (request.testScript?.trim()) {
    const scriptEnv: Record<string, string> = {};
    env.forEach((v) => {
      if (v.enabled && v.key) scriptEnv[v.key] = v.value;
    });
    const testResults = runTestScript(request.testScript, response, { ...scriptEnv, ...data });
    response = { ...response, testResults };
  }
  return { request: finalRequest, response };
};

/** Why a response counts as a failed step, or null if it passed. */
export const getFailureReason = (response: ApiResponse): string | null => {
  if (!response.status) return `${response.statusText || 'Network error'}: the request did not complete`;
  if (response.status >= 400) return `Responded ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  const failedTests = (response.testResults || []).filter((t) => !t.passed);
  if (failedTests.length) return `${failedTests.length} of ${response.testResults!.length} tests failed`;
  return null;
};
