import React, { useState, useEffect, useCallback } from 'react';

export const STORAGE_ERROR_EVENT = 'smartreq:storage-error';

export const usePersistentState = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const getStoredValue = useCallback(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(getStoredValue);

  useEffect(() => {
    try {
      const serializedValue = JSON.stringify(storedValue);
      window.localStorage.setItem(key, serializedValue);
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
      // Writing can fail on quota; the change stays in memory only. Tell the user
      // rather than letting saved requests disappear silently on the next reload.
      window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key } }));
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};
