/**
 * Cartesian product of the non-empty value lists, in row-major order.
 * Rows are built by index, so `limit` caps the work: asking for the first 50
 * rows of an 11M-row product only ever builds 50 objects.
 */
export const generateCombinations = (
  variables: Record<string, string[]>,
  limit = Infinity
): Record<string, string>[] => {
  const entries = Object.entries(variables).filter(([, values]) => values.length > 0);
  if (entries.length === 0) return [{}];
  const total = entries.reduce((n, [, values]) => n * values.length, 1);
  const count = Math.min(total, limit);
  const rows: Record<string, string>[] = [];
  for (let index = 0; index < count; index++) {
    const row: Record<string, string> = {};
    let rest = index;
    for (let k = entries.length - 1; k >= 0; k--) {
      const [key, values] = entries[k];
      row[key] = values[rest % values.length];
      rest = Math.floor(rest / values.length);
    }
    // Preserve key insertion order of the input.
    rows.push(Object.fromEntries(entries.map(([key]) => [key, row[key]])));
  }
  return rows;
};

/** Number of rows generateCombinations would produce (without building them). */
export const countCombinations = (variables: Record<string, string[]>): number => {
  const lists = Object.values(variables).filter((values) => values.length > 0);
  if (lists.length === 0) return 0;
  return lists.reduce((n, values) => n * values.length, 1);
};

/** Coerce a typed value to the JSON type of the field it replaces ("5" -> 5 for a number field). */
export const coerceToTypeOf = (raw: string, original: unknown): unknown => {
  const text = raw.trim();
  if (typeof original === 'number' && text !== '' && !Number.isNaN(Number(text))) return Number(text);
  if (typeof original === 'boolean' && (text === 'true' || text === 'false')) return text === 'true';
  if (original === null && text === 'null') return null;
  if (typeof original === 'object' && original !== null) {
    try {
      return JSON.parse(text);
    } catch {
      return raw;
    }
  }
  return raw;
};

const setPath = (target: Record<string, unknown>, path: string, value: unknown) => {
  const parts = path.split('.');
  let current: any = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current == null || typeof current !== 'object') return;
    current = current[parts[i]];
  }
  if (current != null && typeof current === 'object') current[parts[parts.length - 1]] = value;
};

const getPath = (target: unknown, path: string): unknown =>
  path.split('.').reduce<any>((acc, part) => (acc == null ? undefined : acc[part]), target);

/** Every leaf path in a JSON value, in dot notation (`address.city`, `tags.0`). */
export const listJsonPaths = (value: unknown, prefix = ''): string[] => {
  if (value === null || typeof value !== 'object') return prefix ? [prefix] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => listJsonPaths(v, prefix ? `${prefix}.${k}` : k));
};

export interface BodyPlan {
  /** JSON body template with `{{column}}` placeholders. */
  template: string;
  /** One record per combination; values are ready to interpolate into the template. */
  rows: Record<string, string>[];
  /** The fully built bodies, for preview. */
  bodies: Record<string, unknown>[];
}

/**
 * Turn a base JSON body, the values to vary and derived-field rules into a bulk run:
 * a body template plus one data row per combination. String fields use quoted
 * placeholders with JSON-escaped values; numbers/booleans/objects are inserted raw.
 */
export const planBodyCombinations = (
  base: Record<string, unknown>,
  variables: Record<string, string[]>,
  rules: { key: string; template: string }[] = [],
  limit = Infinity
): BodyPlan => {
  const combos = countCombinations(variables) === 0 ? [] : generateCombinations(variables, limit);
  const keys = Object.keys(variables).filter((k) => variables[k].length > 0);
  const activeRules = rules.filter((r) => r.template && getPath(base, r.key) !== undefined);

  const bodies: Record<string, unknown>[] = [];
  const typed: Record<string, unknown>[] = [];
  combos.forEach((combo) => {
    const body = JSON.parse(JSON.stringify(base));
    const values: Record<string, unknown> = {};
    keys.forEach((k) => {
      values[k] = coerceToTypeOf(combo[k], base[k]);
      body[k] = values[k];
    });
    activeRules.forEach((rule) => {
      const value = rule.template.replace(/\{\{\s*(.+?)\s*\}\}/g, (m, name: string) => (name in combo ? combo[name] : m));
      values[rule.key] = value;
      setPath(body, rule.key, value);
    });
    bodies.push(body);
    typed.push(values);
  });

  const columns = [...keys, ...activeRules.map((r) => r.key)];
  const isStringColumn = (col: string) => typed.some((row) => typeof row[col] === 'string');
  const stringColumns = new Set(columns.filter(isStringColumn));

  const sentinel = (col: string) => `__smartreq_${columns.indexOf(col)}__`;
  const skeleton = JSON.parse(JSON.stringify(base));
  keys.forEach((k) => (skeleton[k] = sentinel(k)));
  activeRules.forEach((r) => setPath(skeleton, r.key, sentinel(r.key)));
  let template = JSON.stringify(skeleton, null, 2);
  columns.forEach((col) => {
    template = template.split(`"${sentinel(col)}"`).join(stringColumns.has(col) ? `"{{${col}}}"` : `{{${col}}}`);
  });

  const rows = typed.map((values) => {
    const row: Record<string, string> = {};
    columns.forEach((col) => {
      const v = values[col];
      row[col] = stringColumns.has(col) ? JSON.stringify(String(v)).slice(1, -1) : JSON.stringify(v);
    });
    return row;
  });

  return { template, rows, bodies };
};
