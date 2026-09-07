'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './bottom-tabs.module.css';
import { foundationStartHref, foundationLanguage } from '@/features/course-pack/navigation';

// Bottom quick nav: Today, Practice (resumes the last-used course), Listen, You.
// Language switching lives in the header switcher; these tabs never duplicate it.
export function QuickNav() {
  const pathname = usePathname() ?? '/';
  const [practiceHref, setPracticeHref] = useState('/dashboard');
  // Deferred read after paint so the effect never sets state synchronously
  // (cascading-render lint): QuickNav renders a safe default first.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem('verbalibera_course');
        const current = pathname.startsWith('/courses/') ? pathname.split('/')[2] : saved;
        if (current && foundationLanguage(current)) setPracticeHref(foundationStartHref(current));
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);
  const tabs = [
    { href: '/dashboard', label: 'Today', fullName: 'Daily path', active: pathname === '/dashboard' },
    {
      href: practiceHref,
      label: 'Practice',
      fullName: 'Resume practice',
      active: pathname.startsWith('/learn/') || pathname.startsWith('/courses/'),
    },
    { href: '/listen', label: 'Listen', fullName: 'Audio lessons', active: pathname.startsWith('/listen') },
    { href: '/you', label: 'You', fullName: 'Account', active: pathname.startsWith('/you') || pathname.startsWith('/login') },
  ];
  if (pathname === '/') return null;
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
