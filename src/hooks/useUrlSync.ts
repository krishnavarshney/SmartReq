import { useEffect, useRef } from 'react';
import { ApiRequest, KeyValueItem } from '../types';
import { parseQueryString, serializeQuery, splitUrl, syncPathVariables } from '../utils/http-data';

type Pair = { key: string; value: string };

const samePairs = (a: Pair[], b: Pair[]) => a.length === b.length && a.every((p, i) => p.key === b[i].key && p.value === b[i].value);
const enabledPairs = (params: KeyValueItem[]): Pair[] => params.filter((p) => p.enabled && p.key).map((p) => ({ key: p.key, value: p.value }));
const samePathVars = (a: KeyValueItem[] = [], b: KeyValueItem[] = []) =>
  a.length === b.length && a.every((p, i) => p.key === b[i].key && p.value === b[i].value);

/** Rebuild the params list from the URL, reusing existing rows (ids, encode flags) where they line up. */
export const paramsFromUrl = (url: string, current: KeyValueItem[]): KeyValueItem[] => {
  const parsed = parseQueryString(splitUrl(url).query);
  const enabled = current.filter((p) => p.enabled && p.key);
  let nextId = Date.now();
  const used = new Set<number>();
  const rows: KeyValueItem[] = parsed.map((p, i) => {
    const sameSlot = enabled[i];
    const sameKey = current.find((c) => c.key === p.key && !used.has(c.id));
    const reuse = [sameSlot, sameKey].find((c) => c && !used.has(c.id));
    const id = reuse ? reuse.id : nextId++;
    used.add(id);
    return {
      id,
      key: p.key,
      value: p.value,
      enabled: true,
      encode: (sameKey ?? sameSlot)?.encode ?? true,
    };
  });
  // Disabled rows are not in the URL; keep them.
  const disabled = current.filter((p) => !p.enabled && (p.key || p.value));
  disabled.forEach((d) => {
    rows.push(used.has(d.id) ? { ...d, id: nextId++ } : d);
  });
  return rows;
};

/** Replace the URL's query string with the enabled params, keeping the rest of the URL as typed. */
export const urlFromParams = (url: string, params: KeyValueItem[]): string => {
  const { base, hash } = splitUrl(url);
  const pairs = enabledPairs(params);
  return `${base}${pairs.length ? `?${serializeQuery(pairs)}` : ''}${hash}`;
};

/**
 * Two-way sync between the URL field and the Params editor, plus `:name` path variables.
 * Whichever side changed since the last render is the source; the other side is only
 * written when it differs semantically, so opening a request never marks it dirty and
 * typing in either place never moves the caret.
 */
export interface UrlSyncOptions {
  /** True when the sync only normalizes a request that was just opened or imported (not a user edit). */
  silent: boolean;
}

export const useUrlSync = (
  request: ApiRequest | undefined,
  updateRequest: (updates: Partial<ApiRequest>, options?: UrlSyncOptions) => void
) => {
  const prev = useRef<{ url?: string; params?: KeyValueItem[] }>({});
  const updateRef = useRef(updateRequest);
  updateRef.current = updateRequest;

  const url = request?.url;
  const params = request?.queryParams;
  const pathVariables = request?.pathVariables;

  useEffect(() => {
    if (url === undefined || !params) return;
    const urlChanged = prev.current.url !== url;
    const paramsChanged = prev.current.params !== params;
    prev.current = { url, params };
    if (!urlChanged && !paramsChanged) return;

    const updates: Partial<ApiRequest> = {};
    const fromUrl = parseQueryString(splitUrl(url).query);
    const inEditor = enabledPairs(params);

    if (!samePairs(fromUrl, inEditor)) {
      // When both changed at once (a request was opened or imported) and the URL carries no
      // query, the params are the source; otherwise whichever side the user edited wins.
      const urlIsSource = urlChanged && !(paramsChanged && fromUrl.length === 0);
      if (urlIsSource) updates.queryParams = paramsFromUrl(url, params);
      else updates.url = urlFromParams(url, params);
    }

    const nextPathVars = syncPathVariables(updates.url ?? url, pathVariables);
    if (!samePathVars(nextPathVars, pathVariables) && (nextPathVars.length > 0 || (pathVariables?.length ?? 0) > 0)) {
      updates.pathVariables = nextPathVars;
    }

    if (Object.keys(updates).length > 0) {
      if (updates.url !== undefined) prev.current.url = updates.url;
      if (updates.queryParams) prev.current.params = updates.queryParams;
      // Both sides changing at once means a different request was loaded; aligning it isn't an edit.
      updateRef.current(updates, { silent: urlChanged && paramsChanged });
    }
  }, [url, params, pathVariables]);
};
