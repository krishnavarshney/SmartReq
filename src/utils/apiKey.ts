const STORAGE_KEY = 'smartreq_gemini_api_key';

export const API_KEY_CHANGE_EVENT = 'smartreq:apikey-change';

/**
 * Read the Gemini key the user entered in Settings.
 * It is deliberately never baked into the bundle: a build-time key ships to every visitor.
 */
export const getApiKey = (): string => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

export const setApiKey = (key: string): void => {
  const trimmed = key.trim();
  try {
    if (trimmed) window.localStorage.setItem(STORAGE_KEY, trimmed);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, quota): the key simply stays unset.
  }
  window.dispatchEvent(new Event(API_KEY_CHANGE_EVENT));
};
