'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './bottom-tabs.module.css';

type Tab = Readonly<{
  href: string;
  label: string;
  fullName: string;
  match: (path: string) => boolean;
}>;

const TABS: readonly Tab[] = [
  { href: '/', label: 'Home', fullName: 'Daily path', match: (path: string) => path === '/' },
  { href: '/learn/english-to-french', label: 'FR', fullName: 'French lessons', match: (path: string) => path === '/learn/english-to-french' },
  { href: '/learn/english-to-italian', label: 'IT', fullName: 'Italian lessons', match: (path: string) => path === '/learn/english-to-italian' },
  { href: '/learn/english-to-spanish', label: 'ES', fullName: 'Spanish lessons', match: (path: string) => path === '/learn/english-to-spanish' },
  { href: '/learn/english-to-portuguese', label: 'PT', fullName: 'Portuguese lessons', match: (path: string) => path === '/learn/english-to-portuguese' },
];

export function BottomTabs() {
  const pathname = usePathname() ?? '/';
  return (
    <nav aria-label="Primary" className={styles.tabs}>
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.fullName ?? tab.label}
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
