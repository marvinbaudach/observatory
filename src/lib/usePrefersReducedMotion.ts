import { useMediaQuery } from './useMediaQuery';

const QUERY = '(prefers-reduced-motion: reduce)';

// Tracks the OS-level reduced-motion setting so the WebGL scene can rest too;
// the CSS media query only reaches the DOM layer.
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(QUERY);
}
