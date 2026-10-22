import {useEffect, useRef} from 'react';
import {focusNode} from '../services/focus';

/**
 * Sets D-pad focus explicitly when a screen mounts.
 *
 * `hasTVPreferredFocus` alone is not reliable on every Vega build — a screen
 * can mount with focus on the wrong element. Focusing via FocusManager after
 * layout is deterministic.
 */
export function useInitialFocus<T>(delayMs = 250) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      focusNode(ref.current);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  return ref;
}
