import { useEffect, useState } from 'react';
import { API_KEY_CHANGE_EVENT, getApiKey } from '../utils/apiKey';

export const useApiKey = (): string => {
  const [apiKey, setApiKeyState] = useState(getApiKey);

  useEffect(() => {
    const onChange = () => setApiKeyState(getApiKey());
    window.addEventListener(API_KEY_CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(API_KEY_CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return apiKey;
};
