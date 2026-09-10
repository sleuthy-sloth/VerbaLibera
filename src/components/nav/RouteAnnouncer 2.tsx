'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Announces client-side route changes to assistive technology.
 *
 * The App Router renders new pages without a document load, so a screen reader
 * gets no "page changed" event at all — and because every route previously
 * shared the title `VerbaLibera · Daily practice path`, even a careful user
 * could not tell one page from another. This renders a polite live region that
 * updates once per pathname change, once the new page has rendered.
 */
export function RouteAnnouncer({ titles }: { titles?: Record<string, string> }) {
  const pathname = usePathname() ?? '/';
  const [message, setMessage] = useState('');
  const firstRender = useRef(true);

  useEffect(() => {
    // Skip the initial render: the document title is already announced by the
    // browser on a real page load, and announcing twice is worse than once.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = document.querySelector('h1');
    const headingText = heading?.textContent?.replace(/\s+/g, ' ').trim();
    const routeName = titles?.[pathname];
    const label = routeName ?? headingText ?? document.title;
    // Clear first so an identical label on two consecutive routes still fires.
    setMessage('');
    const timer = setTimeout(() => setMessage(`${label}`), 150);
    return () => clearTimeout(timer);
  }, [pathname, titles]);

  return (
    // `aria-live` without `role="status"`: the announcement is real, but giving
    // this element the status role adds a second competing status live region to
    // every page (the player's own role="status" feedback is the one that
    // matters), and `role="status"` only implies these two attributes anyway.
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </div>
  );
}
