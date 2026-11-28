import { useState, useEffect } from 'react';

const query = (q: string) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;

/** Subscribe to a CSS media query. Reads the current value synchronously so the first render is correct. */
export function useMediaQuery(q: string) {
  const [matches, setMatches] = useState(() => query(q));

  useEffect(() => {
    const mediaQuery = window.matchMedia(q);
    setMatches(mediaQuery.matches);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [q]);

  return matches;
}
