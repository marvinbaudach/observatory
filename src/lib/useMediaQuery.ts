import { useCallback, useSyncExternalStore } from 'react';

// One MediaQueryList and one DOM listener per distinct query, shared by every
// subscriber. The scene reads reduced motion from a dozen components; without
// the sharing each of them attached its own listener.
interface Entry {
  mql: MediaQueryList;
  listeners: Set<() => void>;
  notify: () => void;
}

const entries = new Map<string, Entry>();

function entryFor(query: string): Entry {
  let entry = entries.get(query);
  if (!entry) {
    const listeners = new Set<() => void>();
    entry = {
      mql: window.matchMedia(query),
      listeners,
      notify: () => { listeners.forEach(l => { l(); }); },
    };
    entries.set(query, entry);
  }
  return entry;
}

function subscribeTo(query: string, onChange: () => void): () => void {
  const entry = entryFor(query);
  if (entry.listeners.size === 0) entry.mql.addEventListener('change', entry.notify);
  entry.listeners.add(onChange);
  return () => {
    entry.listeners.delete(onChange);
    if (entry.listeners.size === 0) entry.mql.removeEventListener('change', entry.notify);
  };
}

/** One-off read for code that does not need to follow changes. */
export function matchesQuery(query: string): boolean {
  return entryFor(query).mql.matches;
}

// Tracks a CSS media query so the WebGL scene can follow the same breakpoints
// as the DOM layer. Server render and first paint assume "no match".
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => subscribeTo(query, onChange), [query]);
  return useSyncExternalStore(
    subscribe,
    () => matchesQuery(query),
    () => false,
  );
}
