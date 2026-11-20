import { useSyncExternalStore } from 'react';

// Tracks a CSS media query so the WebGL scene can follow the same breakpoints
// as the DOM layer. Server render and first paint assume "no match".
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    onChange => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => { mql.removeEventListener('change', onChange); };
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
