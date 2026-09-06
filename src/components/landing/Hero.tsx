import Link from 'next/link';
import s from './landing.module.css';

const phrases = [
  { phrase: 'I want', gloss: 'the thought, in your language', lang: 'en' },
  { phrase: 'Je voudrais', gloss: 'a polite “I would like”', note: 'subject + verb in the conditional', lang: 'fr' },
  { phrase: 'Je voudrais un café', gloss: 'add the thing you want', lang: 'fr' },
  { phrase: 'Je voudrais un café, s’il vous plaît.', gloss: '“I would like a coffee, please.”', note: 'finish the sentence — polite, complete, yours', lang: 'fr' },
];

export function Hero() {
  return <section className={s.section} aria-labelledby="hero-heading">
    <div className={`${s.container} ${s.split}`}>
      <div><p className={`${s.eyebrow} ${s.accent}`}>Open-source language learning</p>
        <h1 id="hero-heading">Stop guessing.<br /> Start building<br /> sentences.</h1>
        <p className={s.lead}>VerbaLibera teaches you how a language fits together, then asks you to use it. Structured lessons, deliberate practice — and no streak demanding your attention.</p>
        <div className={s.actions}><Link href="/dashboard" className={s.primary}>Start learning</Link><a href="#method" className={s.secondary}>See how it works</a></div>
        <p className={s.finePrint}>Free, open-source &amp; BSD licensed. <a href="#open-source">View the source</a></p>
      </div>
      <div className={s.board}>
        <div className={s.boardHead}><span className={s.label}>A sentence, built</span><span className={s.meta}><span lang="fr">Je voudrais</span> + noun</span></div>
        <ol className={s.chain}>{phrases.map((item, i) => <li key={item.phrase}>
          <span className={s.stepNumber} aria-hidden="true">{i + 1}</span><span className={s.phrase} lang={item.lang}>{item.phrase}</span><span className={s.gloss}>{item.gloss}</span>
          {item.note && <span className={s.annotation}>{item.note}</span>}
        </li>)}</ol>
        <div className={s.boardFoot}><span>You build the language</span><span>one thought at a time</span></div>
      </div>
    </div>
  </section>;
}
