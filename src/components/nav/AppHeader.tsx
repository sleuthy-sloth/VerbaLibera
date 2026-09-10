'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from './app-header.module.css';

/**
 * Desktop top navigation.
 *
 * The bottom tab capsule is hidden at >=768px, and before this component only
 * `/` (landing header) and `/dashboard` (its own brand header) replaced it — so
 * `/listen`, `/you`, `/login` and `/courses/*` had no way out except the browser
 * back button. Measured: `/listen` at 1280px had five keyboard stops and no
 * navigation at all.
 *
 * Mobile keeps the bottom capsule; this is `display: none` below 768px so the
 * two never duplicate each other.
 */

export const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Today' },
  { href: '/courses', label: 'Courses' },
  { href: '/listen', label: 'Listen' },
  { href: '/you', label: 'You' },
] as const;

/** Routes that own their own header (landing) or the dashboard's brand row. */
const SELF_HEADERED = new Set(['/', '/dashboard']);

export function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/courses') return pathname.startsWith('/courses') || pathname.startsWith('/learn');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader() {
  const pathname = usePathname() ?? '/';
  if (SELF_HEADERED.has(pathname)) return null;
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/dashboard" className={styles.brand} aria-label="VerbaLibera — Today">
          <Image src="/brand/logo-mark.jpg" alt="" width={32} height={32} />
          <span>VerbaLibera</span>
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.link}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
