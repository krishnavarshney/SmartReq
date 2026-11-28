import { KeyValueItem } from '../types';

const randomUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/** Built-in `{{$name}}` variables, generated fresh on every send (Postman-compatible names). */
export const DYNAMIC_VARIABLES: Record<string, { description: string; generate: () => string }> = {
  $guid: { description: 'A random v4 UUID', generate: randomUuid },
  $randomuuid: { description: 'A random v4 UUID', generate: randomUuid },
  $timestamp: { description: 'Current Unix time in seconds', generate: () => String(Math.floor(Date.now() / 1000)) },
  $isotimestamp: { description: 'Current time as ISO 8601', generate: () => new Date().toISOString() },
  $randomint: { description: 'A random integer 0-1000', generate: () => String(Math.floor(Math.random() * 1001)) },
};

export const isDynamicVariable = (name: string): boolean => name.trim().toLowerCase() in DYNAMIC_VARIABLES;

/** Replace `{{key}}` case-insensitively. Unknown variables are left as typed. */
export const interpolateString = (template: string, variables: Record<string, string>): string => {
  if (!template) return '';
  return template.replace(/\{\{(.+?)\}\}/g, (match, key: string) => {
    const trimmedKey = key.trim().toLowerCase();
    const value = variables[trimmedKey];
    if (value !== undefined) return value;
    const dynamic = DYNAMIC_VARIABLES[trimmedKey];
    return dynamic ? dynamic.generate() : match;
  });
};

/** Lower-cased lookup of enabled environment/global variables, overridden by data-row values. */
export const buildVariableMap = (env: KeyValueItem[], data: Record<string, string> = {}): Record<string, string> => {
  const map: Record<string, string> = {};
  env.filter((v) => v.enabled && v.key).forEach((v) => {
    map[v.key.trim().toLowerCase()] = v.value;
  });
  Object.entries(data).forEach(([key, value]) => {
    map[key.trim().toLowerCase()] = value;
  });
  return map;
};

export type VariableSource = 'environment' | 'data' | 'dynamic' | 'unresolved';

export interface ResolvedVariable {
  name: string;
  value?: string;
  source: VariableSource;
}

/** Explain how one `{{name}}` resolves, for previews and hover cards. */
export const resolveVariable = (name: string, env: KeyValueItem[], data?: Record<string, string>): ResolvedVariable => {
  const key = name.trim().toLowerCase();
  const fromData = data ? Object.entries(data).find(([k]) => k.trim().toLowerCase() === key) : undefined;
  if (fromData) return { name, value: String(fromData[1]), source: 'data' };
  // Later entries win, matching buildVariableMap (globals first, then the active environment).
  const fromEnv = [...env].reverse().find((v) => v.enabled && v.key && v.key.trim().toLowerCase() === key);
  if (fromEnv) return { name, value: fromEnv.value, source: 'environment' };
  if (key in DYNAMIC_VARIABLES) return { name, value: DYNAMIC_VARIABLES[key].description, source: 'dynamic' };
  return { name, source: 'unresolved' };
};
