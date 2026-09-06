'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './bottom-tabs.module.css';

// Bottom quick nav: Today, Practice (resumes the last-used course), You.
// Language switching lives in the header switcher; these tabs never duplicate it.
export function QuickNav() {
  const pathname = usePathname() ?? '/';
  const [practiceHref, setPracticeHref] = useState('/');
  // Deferred read after paint so the effect never sets state synchronously
  // (cascading-render lint): QuickNav renders a safe default first.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem('verbalibera_course');
        if (saved) setPracticeHref(`/learn/${saved}`);
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const tabs = [
    { href: '/', label: 'Today', fullName: 'Daily path', active: pathname === '/' },
    {
      href: practiceHref,
      label: 'Practice',
      fullName: 'Resume practice',
      active: pathname.startsWith('/learn/') || pathname.startsWith('/courses/'),
    },
    { href: '/you', label: 'You', fullName: 'Account', active: pathname.startsWith('/you') || pathname.startsWith('/login') },
  ];
  return (
    <nav aria-label="Primary" className={styles.tabs}>
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          aria-label={tab.fullName}
          aria-current={tab.active ? 'page' : undefined}
          data-active={tab.active || undefined}
          className={styles.tab}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
