'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './bottom-tabs.module.css';
import { isActive, PRIMARY_NAV } from './AppHeader';

/**
 * Mobile bottom navigation (<768px). Desktop gets the same four destinations
 * from `AppHeader` — keep the two lists in sync via `PRIMARY_NAV`.
 *
 * The previous tab set was Today / Practice / Listen / You, where "Practice"
 * resolved to `localStorage.verbalibera_course` and defaulted to `/dashboard` —
 * so on a first visit two of the four tabs pointed at the same URL, and the
 * label never said what it practised. Resuming a course now lives on the Today
 * page as its primary action, where it has room to say which course it resumes.
 */
export function QuickNav() {
  const pathname = usePathname() ?? '/';
  if (pathname === '/') return null;
  return (
    <nav aria-label="Primary" className={styles.tabs}>
      {PRIMARY_NAV.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            data-active={active || undefined}
            className={styles.tab}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
