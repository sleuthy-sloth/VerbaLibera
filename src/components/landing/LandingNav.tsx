'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import s from './landing.module.css';

const links = [['#method', 'How it works'], ['#courses', 'Courses'], ['#philosophy', 'Philosophy'], ['#open-source', 'Open source']] as const;

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return <header className={s.nav} onKeyDown={event => {
    if (event.key === 'Escape' && open) { setOpen(false); toggle.current?.focus(); }
  }}>
    <div className={`${s.container} ${s.navInner}`}>
      <Link href="/" className={s.brand} aria-label="VerbaLibera home">
        <Image src="/brand/logo-mark.jpg" alt="" width={32} height={32} />
        <span>VerbaLibera</span>
      </Link>
      <nav className={s.desktopNav} aria-label="About VerbaLibera">
        {links.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
      </nav>
      <div className={s.navActions}>
        <Link href="/login" className={s.signIn}>Sign in</Link>
        <Link href="/dashboard" className={s.primary}>Start learning</Link>
      </div>
      <button ref={toggle} className={s.menuToggle} aria-expanded={open} aria-controls="landing-menu" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Menu'} <span aria-hidden="true">{open ? '×' : '☰'}</span></button>
      <nav id="landing-menu" className={s.mobileNav} aria-label="Mobile navigation" hidden={!open}>
        {links.map(([href, label]) => <a href={href} key={href} onClick={() => setOpen(false)}>{label}</a>)}
        <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>
        <Link href="/dashboard" className={s.primary}>Start learning</Link>
      </nav>
    </div>
  </header>;
}
