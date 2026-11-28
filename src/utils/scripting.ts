import { ApiResponse, HttpMethod, KeyValueItem, TestResult } from '../types';
import { interpolateString } from './interpolation';

/* ------------------------------------------------------------------------- */
/* Assertions: a small, dependency-free subset of chai's BDD `expect` API.    */
/* ------------------------------------------------------------------------- */

const typeOf = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as any)[k], (b as any)[k]));
};

const show = (value: unknown): string => {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === undefined) return 'undefined';
  try {
    const text = JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  } catch {
    return String(value);
  }
};

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

class Assertion {
  private negated = false;
  private deepFlag = false;

  constructor(private readonly actual: any) {}

  // Language chains (no-ops, for readability).
  get to() { return this; }
  get be() { return this; }
  get been() { return this; }
  get is() { return this; }
  get that() { return this; }
  get which() { return this; }
  get and() { return this; }
  get has() { return this; }
  get have() { return this; }
  get with() { return this; }
  get at() { return this; }
  get of() { return this; }
  get same() { return this; }
  get does() { return this; }
  get not() { this.negated = !this.negated; return this; }
  get deep() { this.deepFlag = true; return this; }

  private check(pass: boolean, message: string, negatedMessage: string): this {
    if (this.negated ? pass : !pass) throw new AssertionError(this.negated ? negatedMessage : message);
    return this;
  }

  equal(expected: unknown) {
    const pass = this.deepFlag ? deepEqual(this.actual, expected) : this.actual === expected;
    return this.check(pass, `expected ${show(this.actual)} to equal ${show(expected)}`, `expected ${show(this.actual)} to not equal ${show(expected)}`);
  }
  equals(expected: unknown) { return this.equal(expected); }
  eq(expected: unknown) { return this.equal(expected); }

  eql(expected: unknown) {
    return this.check(
      deepEqual(this.actual, expected),
      `expected ${show(this.actual)} to deeply equal ${show(expected)}`,
      `expected ${show(this.actual)} to not deeply equal ${show(expected)}`
    );
  }

  a(type: string) {
    const actualType = typeOf(this.actual);
    const wanted = type.toLowerCase();
    return this.check(actualType === wanted, `expected ${show(this.actual)} to be a ${wanted}`, `expected ${show(this.actual)} not to be a ${wanted}`);
  }
  an(type: string) { return this.a(type); }

  include(subset: unknown) {
    const value = this.actual;
    let pass: boolean;
    if (Array.isArray(value)) pass = value.some((item) => deepEqual(item, subset));
    else if (typeof value === 'string') pass = value.includes(String(subset));
    else if (value && typeof value === 'object')
      pass = typeof subset === 'object' && subset !== null
        ? Object.entries(subset).every(([k, v]) => deepEqual((value as any)[k], v))
        : Object.prototype.hasOwnProperty.call(value, String(subset));
    else pass = false;
    return this.check(pass, `expected ${show(value)} to include ${show(subset)}`, `expected ${show(value)} to not include ${show(subset)}`);
  }
  includes(subset: unknown) { return this.include(subset); }
  contain(subset: unknown) { return this.include(subset); }
  contains(subset: unknown) { return this.include(subset); }

  /** Asserts the property exists (and optionally equals `value`), then continues on the property's value. */
  property(name: string, ...rest: unknown[]): Assertion {
    const value = this.actual;
    const has = value !== null && value !== undefined && typeof value === 'object' && name in value;
    if (rest.length === 0) {
      this.check(has, `expected ${show(value)} to have property '${name}'`, `expected ${show(value)} to not have property '${name}'`);
    } else {
      const propValue = has ? (value as any)[name] : undefined;
      const pass = has && (this.deepFlag ? deepEqual(propValue, rest[0]) : propValue === rest[0]);
      this.check(
        pass,
        `expected ${show(value)} to have property '${name}' of ${show(rest[0])}${has ? `, but got ${show(propValue)}` : ''}`,
        `expected ${show(value)} to not have property '${name}' of ${show(rest[0])}`
      );
    }
    return this.negated ? this : new Assertion(has ? (value as any)[name] : undefined);
  }

  lengthOf(n: number) {
    const len = this.actual?.length ?? (this.actual instanceof Map || this.actual instanceof Set ? this.actual.size : undefined);
    return this.check(len === n, `expected ${show(this.actual)} to have a length of ${n} but got ${len}`, `expected ${show(this.actual)} to not have a length of ${n}`);
  }

  above(n: number) {
    return this.check(this.actual > n, `expected ${show(this.actual)} to be above ${n}`, `expected ${show(this.actual)} to be at most ${n}`);
  }
  gt(n: number) { return this.above(n); }
  greaterThan(n: number) { return this.above(n); }

  below(n: number) {
    return this.check(this.actual < n, `expected ${show(this.actual)} to be below ${n}`, `expected ${show(this.actual)} to be at least ${n}`);
  }
  lt(n: number) { return this.below(n); }
  lessThan(n: number) { return this.below(n); }

  least(n: number) {
    return this.check(this.actual >= n, `expected ${show(this.actual)} to be at least ${n}`, `expected ${show(this.actual)} to be below ${n}`);
  }
  gte(n: number) { return this.least(n); }

  most(n: number) {
    return this.check(this.actual <= n, `expected ${show(this.actual)} to be at most ${n}`, `expected ${show(this.actual)} to be above ${n}`);
  }
  lte(n: number) { return this.most(n); }

  within(min: number, max: number) {
    const pass = this.actual >= min && this.actual <= max;
    return this.check(pass, `expected ${show(this.actual)} to be within ${min}..${max}`, `expected ${show(this.actual)} to not be within ${min}..${max}`);
  }

  oneOf(list: unknown[]) {
    const pass = list.some((item) => deepEqual(item, this.actual));
    return this.check(pass, `expected ${show(this.actual)} to be one of ${show(list)}`, `expected ${show(this.actual)} to not be one of ${show(list)}`);
  }

  match(re: RegExp) {
    return this.check(re.test(String(this.actual)), `expected ${show(this.actual)} to match ${re}`, `expected ${show(this.actual)} not to match ${re}`);
  }

  get ok() { return this.check(!!this.actual, `expected ${show(this.actual)} to be truthy`, `expected ${show(this.actual)} to be falsy`); }
  get true() { return this.check(this.actual === true, `expected ${show(this.actual)} to be true`, `expected ${show(this.actual)} to not be true`); }
  get false() { return this.check(this.actual === false, `expected ${show(this.actual)} to be false`, `expected ${show(this.actual)} to not be false`); }
  get null() { return this.check(this.actual === null, `expected ${show(this.actual)} to be null`, `expected ${show(this.actual)} to not be null`); }
  get undefined() { return this.check(this.actual === undefined, `expected ${show(this.actual)} to be undefined`, `expected value to not be undefined`); }
  get exist() {
    return this.check(this.actual !== null && this.actual !== undefined, `expected ${show(this.actual)} to exist`, `expected ${show(this.actual)} to not exist`);
  }
  get empty() {
    const v = this.actual;
    const isEmpty = v == null ? true : typeof v === 'string' || Array.isArray(v) ? v.length === 0 : typeof v === 'object' ? Object.keys(v).length === 0 : false;
    return this.check(isEmpty, `expected ${show(v)} to be empty`, `expected ${show(v)} to not be empty`);
  }
}

export const expect = (value: unknown) => new Assertion(value);

/* ------------------------------------------------------------------------- */
/* Shared variable scope                                                     */
/* ------------------------------------------------------------------------- */

/** Case-insensitive variable bag shared by pm.variables / pm.environment / pm.globals. */
const createVariableScope = (initial: Record<string, string>) => {
  const store: Record<string, string> = {};
  Object.entries(initial).forEach(([k, v]) => {
    store[k.toLowerCase()] = v;
  });
  const scope = {
    get: (key: string) => store[String(key).toLowerCase()],
    set: (key: string, value: unknown) => {
      store[String(key).toLowerCase()] = typeof value === 'string' ? value : JSON.stringify(value);
    },
    has: (key: string) => String(key).toLowerCase() in store,
    unset: (key: string) => {
      delete store[String(key).toLowerCase()];
    },
    toObject: () => ({ ...store }),
    replaceIn: (template: string) => interpolateString(template, store),
  };
  return { scope, store };
};

/* ------------------------------------------------------------------------- */
/* Test scripts                                                              */
/* ------------------------------------------------------------------------- */

export const runTestScript = (script: string, response: ApiResponse, env: Record<string, any>): TestResult[] => {
  const results: TestResult[] = [];
  let testDepth = 0;
  const { scope } = createVariableScope(
    Object.fromEntries(Object.entries(env).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)]))
  );

  /** Inside pm.test a failed response assertion throws (failing that test); outside it is recorded on its own. */
  const record = (name: string, passed: boolean, error: string) => {
    if (testDepth > 0) {
      if (!passed) throw new AssertionError(error);
      return;
    }
    results.push({ name, passed, error: passed ? undefined : error });
  };

  const findHeader = (key: string) => {
    const match = Object.keys(response.headers || {}).find((h) => h.toLowerCase() === String(key).toLowerCase());
    return match ? response.headers[match] : undefined;
  };

  const parseJson = () => {
    if (typeof response.body !== 'string') return response.body;
    try {
      return JSON.parse(response.body);
    } catch {
      throw new Error('Response body is not valid JSON');
    }
  };

  const responseAssertions = {
    status: (code: number | string) => {
      const passed = typeof code === 'number' ? response.status === code : response.statusText.toLowerCase() === String(code).toLowerCase();
      record(`Status code is ${code}`, passed, `expected status ${code} but got ${response.status} ${response.statusText}`.trim());
    },
    header: (key: string, value?: string) => {
      const actual = findHeader(key);
      const passed = actual !== undefined && (value === undefined || actual === value);
      record(
        value === undefined ? `Header '${key}' is present` : `Header '${key}' is '${value}'`,
        passed,
        actual === undefined ? `expected header '${key}' to be present` : `expected header '${key}' to be '${value}' but got '${actual}'`
      );
    },
    jsonBody: (path?: string) => {
      let body: any;
      try {
        body = parseJson();
      } catch {
        record('Body is JSON', false, 'expected the response body to be valid JSON');
        return;
      }
      if (!path) {
        record('Body is JSON', true, '');
        return;
      }
      const value = path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), body);
      record(`Body has '${path}'`, value !== undefined, `expected the JSON body to have '${path}'`);
    },
  };

  const pm = {
    response: {
      ...response,
      code: response.status,
      responseTime: response.duration,
      json: parseJson,
      text: () => (typeof response.body === 'string' ? response.body : JSON.stringify(response.body)),
      headers: {
        get: findHeader,
        has: (key: string) => findHeader(key) !== undefined,
        toObject: () => ({ ...(response.headers || {}) }),
      },
      to: {
        have: responseAssertions,
        be: {
          get ok() {
            record('Status is 2xx', response.status >= 200 && response.status < 300, `expected a 2xx status but got ${response.status}`);
            return true;
          },
          get success() {
            record('Status is 2xx', response.status >= 200 && response.status < 300, `expected a 2xx status but got ${response.status}`);
            return true;
          },
        },
      },
    },
    test: (name: string, callback: () => void) => {
      testDepth++;
      try {
        callback();
        results.push({ name, passed: true });
      } catch (e) {
        results.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) });
      } finally {
        testDepth--;
      }
    },
    expect,
    variables: scope,
    environment: scope,
    globals: scope,
  };

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('pm', 'expect', script);
    fn(pm, expect);
  } catch (e) {
    results.push({ name: 'Script error', passed: false, error: e instanceof Error ? e.message : String(e) });
  }

  return results;
};

/* ------------------------------------------------------------------------- */
/* Pre-request scripts                                                       */
/* ------------------------------------------------------------------------- */

export interface PreRequestInput {
  method: HttpMethod;
  url: string;
  headers: KeyValueItem[];
  body?: string;
  /** Lower-cased variable map used for interpolation. */
  variables: Record<string, string>;
}

export interface PreRequestResult {
  method: HttpMethod;
  url: string;
  headers: KeyValueItem[];
  variables: Record<string, string>;
  error?: string;
}

/**
 * Run a pre-request script synchronously. The script can read and set variables
 * (`pm.variables`, `pm.environment`, `pm.globals`; changes apply to this send only)
 * and edit the outgoing request (`pm.request.url`, `.method`, `.headers`).
 */
export const runPreRequestScript = (script: string, input: PreRequestInput): PreRequestResult => {
  const { scope, store } = createVariableScope(input.variables);
  let headers = input.headers.map((h) => ({ ...h }));
  let nextId = Date.now();
  const state = { url: input.url, method: input.method };

  const findIndex = (key: string) => headers.findIndex((h) => h.enabled && h.key.toLowerCase() === String(key).toLowerCase());

  const headerApi = {
    add: (header: { key: string; value: unknown } | string, value?: unknown) => {
      const h = typeof header === 'string' ? { key: header, value } : header;
      headers.push({ id: nextId++, key: String(h.key), value: String(h.value ?? ''), enabled: true });
    },
    upsert: (header: { key: string; value: unknown }) => {
      const idx = findIndex(header.key);
      const item = { id: nextId++, key: String(header.key), value: String(header.value ?? ''), enabled: true };
      if (idx >= 0) headers[idx] = { ...headers[idx], value: item.value };
      else headers.push(item);
    },
    remove: (key: string) => {
      headers = headers.filter((h) => h.key.toLowerCase() !== String(key).toLowerCase());
    },
    get: (key: string) => {
      const idx = findIndex(key);
      return idx >= 0 ? headers[idx].value : undefined;
    },
    has: (key: string) => findIndex(key) >= 0,
    toObject: () => Object.fromEntries(headers.filter((h) => h.enabled && h.key).map((h) => [h.key, h.value])),
  };

  const pm = {
    variables: scope,
    environment: scope,
    globals: scope,
    request: {
      get url() { return state.url; },
      set url(value: string) { state.url = String(value); },
      get method() { return state.method; },
      set method(value: HttpMethod) { state.method = String(value).toUpperCase() as HttpMethod; },
      headers: headerApi,
      body: { raw: input.body ?? '' },
    },
    expect,
  };

  let error: string | undefined;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('pm', 'expect', script);
    fn(pm, expect);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return { method: state.method, url: state.url, headers, variables: { ...store }, error };
};
