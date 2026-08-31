'use client';

import { useEffect } from 'react';

/** Registers only the static, privacy-safe PWA cache after the app reaches a browser. */
export function PwaRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is an enhancement; the learning path remains available online.
    });
  }, []);

  return null;
}
