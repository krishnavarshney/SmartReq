import React, { useState, useEffect, useRef } from 'react';

export const STORAGE_ERROR_EVENT = 'smartreq:storage-error';

/**
 * Keys whose last write failed. The error event fires only when this set goes
 * from empty to non-empty, so a full quota produces one notice instead of one
 * per keystroke. A key leaves the set once it saves successfully again.
 */
const failingKeys = new Set<string>();

const reportWrite = (key: string, ok: boolean, error?: unknown) => {
  if (ok) {
    failingKeys.delete(key);
    return;
  }
  if (failingKeys.has(key)) return;
  console.error(`Could not save "${key}" to localStorage:`, error);
  const wasHealthy = failingKeys.size === 0;
  failingKeys.add(key);
  if (wasHealthy) window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key } }));
};

export const usePersistentState = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });
  const isFirstRun = useRef(true);

  useEffect(() => {
    // The initial value either came from storage or is the default: nothing new to save.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      try {
        if (window.localStorage.getItem(key) !== null) return;
      } catch {
        return;
      }
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
      reportWrite(key, true);
    } catch (error) {
      // Writing can fail on quota; the change stays in memory only. Tell the user
      // (once) rather than letting saved requests disappear silently on reload.
      reportWrite(key, false, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};
