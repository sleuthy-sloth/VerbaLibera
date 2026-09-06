import Link from 'next/link';
import s from './landing.module.css';

export const repositoryUrl = 'https://github.com/sleuthy-sloth/VerbaLibera';

export function LandingClosing() {
  return <>
    <section className={s.section} id="open-source" aria-labelledby="source-heading"><div className={`${s.container} ${s.split}`}>
      <div><p className={`${s.eyebrow} ${s.accent}`}>Open source</p><h2 id="source-heading">Built in the open.</h2><p className={s.lead}>Study with it. Run it yourself. Inspect how it works. Help improve it. VerbaLibera is software you can read.</p><div className={s.actions}><a href={repositoryUrl} className={s.secondary}>View on GitHub</a><span className={s.meta}>BSD-3-Clause license</span></div></div>
      <div className={s.terminal} aria-label="Inside the open-source project"><div className={s.terminalHead} aria-hidden="true"><i /><i /><i /></div><p>VerbaLibera /</p><p>├─ <span>sentence construction</span></p><p>├─ <span>local foundation checking</span></p><p>├─ <span>offline packs &amp; model audio</span></p><p>└─ <span>your next sentence</span></p><a href={`${repositoryUrl}#readme`}>Read the setup guide →</a></div>
    </div></section>
    <section className={s.section} id="cta" aria-labelledby="cta-heading"><div className={`${s.container} ${s.closing}`}>
      <p className={`${s.eyebrow} ${s.accent}`}>Begin</p><h2 id="cta-heading">Build your first sentence.</h2><p className={s.lead}>Start with French or Italian and see how VerbaLibera approaches language learning.</p><div className={s.actions}><Link href="/dashboard" className={s.primary}>Start learning</Link><a className={s.textLink} href={repositoryUrl}>View the source →</a></div>
      <div className={`${s.board} ${s.loopBoard}`}>{[['Vorrei', '“I would like” · polite'], ['Vorrei prenotare', '“I would like to book”'], ['Vorrei prenotare un tavolo.', '“I would like to book a table.”']].map(([phrase, gloss]) => <div className={s.loopRow} key={phrase}><span lang="it">{phrase}</span><span className={s.gloss}>{gloss}</span></div>)}</div>
    </div></section>
  </>;
}

export function LandingFooter() {
  return <footer className={s.footer}><div className={s.container}>
    <div className={s.footerTop}><div><Link href="/" className={s.brand}>VerbaLibera</Link><p className={s.gloss}>Learn by building.</p></div>
      <nav aria-label="Footer" className={s.footerColumns}>
        <div><h2>Learn</h2><a href="#method">How it works</a><a href="#courses">Courses</a><a href="#philosophy">Philosophy</a></div>
        <div><h2>Project</h2><a href="#open-source">About</a><a href={repositoryUrl}>GitHub</a></div>
        <div><h2>Trust</h2><a href="#privacy">Privacy</a><a href="#privacy">Local-first</a></div>
      </nav>
    </div><div className={s.footerNote}><span>© 2026 VerbaLibera · Learn by building.</span><span>Open-source software. Built for people who want to think, not streak.</span></div>
  </div></footer>;
}
