'use client';

import { useEffect } from 'react';

/**
 * Marks hydration completion for browser tests: interactions sent before
 * React attaches listeners (e.g. keyboard Enter on a button) are silently
 * lost, which flakes e2e on slow runners. Tests wait on
 * `document.documentElement.dataset.hydrated === 'true'` before interacting.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return null;
}
