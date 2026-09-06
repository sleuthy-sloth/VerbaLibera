'use client';

import { useState } from 'react';
import s from './landing.module.css';

export function SentenceBuilderDemo() {
  const [revealed, setRevealed] = useState(false);
  return <div className={s.lesson}>
    <div><p className={s.label}>Pattern</p><p className={s.pattern}><span lang="fr">Je voudrais</span> + noun</p><p className={s.gloss}>“I would like…”</p></div>
    <span className={s.arrow} aria-hidden="true">→</span>
    <div><p className={s.label}>Example</p><p className={s.example} lang="fr">Je voudrais un café.</p><p className={s.gloss}>“I would like a coffee.”</p></div>
    <span className={s.arrow} aria-hidden="true">→</span>
    <div><p className={s.label}>Your turn</p><label htmlFor="landing-answer" className={s.prompt}>I would like a table.</label>
      <input id="landing-answer" className={s.answerInput} placeholder="Construct your sentence…" lang="fr" autoComplete="off" spellCheck={false} />
      <button className={s.revealButton} aria-expanded={revealed} aria-controls="landing-model" onClick={() => setRevealed(!revealed)}>{revealed ? 'Hide model answer' : 'Reveal model answer'}</button>
      <div id="landing-model" hidden={!revealed} className={s.modelAnswer}><span lang="fr">Je voudrais une table.</span><span className={s.gloss}>“I would like a table.”</span></div>
    </div>
  </div>;
}
