import Image from 'next/image';
import Link from 'next/link';
import { ListeningSample } from './ListeningSample';
import s from './landing.module.css';

const privacy = [
  ['Foundation answers stay on your device', 'Deterministic checking, including in downloaded lessons.'],
  ['No LLM required to study', 'Lessons, model audio, and practice work without a generative AI service.'],
  ['Recording is your choice', 'Microphone use is optional; recordings are not saved by default.'],
  ['Guest foundation study can stay device-local', 'Start and keep practicing without an account.'],
  ['Accounts use passkeys', 'Sign in to sync supported progress across your devices.'],
];

export function StudyFeatures() {
  return <>
    <section className={s.section} id="offline" aria-labelledby="offline-heading"><div className={`${s.container} ${s.offlineLayout}`}>
      <div className={s.phones} role="group" aria-label="Illustration of downloaded foundation lessons">
        <div className={s.phone}><div className={s.phoneStatus}><span>● Connected</span><span>Ready</span></div><div className={s.phoneScreen}><h3 lang="fr">Je suis Anna.</h3><p className={s.meta}>French foundations</p><div className={s.progressLine} /><p className={s.phoneChip}><strong>Pattern</strong><span lang="fr">Je suis</span> + name · audio ready</p></div></div>
        <div className={s.phone}><div className={s.phoneStatus}><span>Offline</span><span aria-hidden="true">▬▬▬</span></div><div className={s.phoneScreen}><h3>Lessons available offline</h3><p className={s.meta}>Downloaded · French</p><div className={s.progressLine} /><p className={s.phoneChip}><strong>Still here</strong>Patterns, audio &amp; drills — no signal.</p></div></div>
      </div>
      <div><p className={s.eyebrow}>Offline</p><h2 id="offline-heading">Take the lesson with you.<br /> Leave the connection behind.</h2><p className={s.lead}>Structured foundation material — lessons, examples, and model audio — can be downloaded for offline study. On a plane, a train, or a quiet room with no signal, the lesson is still there.</p><Link className={s.textLink} href="/courses/french">Explore offline foundations →</Link></div>
    </div></section>
    <section className={s.section} id="listening" aria-labelledby="listening-heading"><div className={`${s.container} ${s.split}`}>
      <div><p className={s.eyebrow}>Listening &amp; pronunciation</p><h2 id="listening-heading">Hear the language<br /> the way it’s spoken.</h2><p className={s.lead}>Prerecorded model pronunciation, a slow replay when you need it, optional dictation, and listening-focused material. Listen closely, then try it yourself.</p><Link className={s.textLink} href="/listen">Explore listening lessons →</Link></div>
      <ListeningSample />
    </div></section>
    <section className={s.section} id="privacy" aria-labelledby="privacy-heading"><div className={`${s.container} ${s.split}`}>
      <div className={s.journal}><Image src="/brand/empty-journal.jpg" alt="An open journal with a growing seedling" width={1024} height={1024} sizes="(max-width: 920px) 90vw, 520px" /></div>
      <div><p className={s.eyebrow}>Local-first &amp; private</p><h2 id="privacy-heading">Your practice doesn’t need to become someone else’s data.</h2><p className={s.prose}>Practice as a guest, or choose an account for synchronization. The feeling is ownership.</p><ul className={s.privacyList}>{privacy.map(([title, body], i) => <li key={title}><span aria-hidden="true">0{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ul></div>
    </div></section>
    <section className={s.section} aria-labelledby="mobile-heading"><div className={s.container}>
      <div className={s.sectionHead}><p className={s.eyebrow}>Mobile-first</p><h2 id="mobile-heading">Designed for the phone<br /> in your hand.</h2><p>A glimpse of the learning method — a course at a glance, a pattern explained, a sentence under construction.</p></div>
      <div className={s.slates}>
        <div className={s.slate}><p className={s.label}>Course dashboard</p><h3>French · A1</h3><p className={s.meta}>Foundation course</p>{['Names and introductions', 'Where you are from', 'A coffee, please'].map(title => <p className={s.slateLine} key={title}>{title}<span aria-hidden="true">→</span></p>)}</div>
        <div className={s.slate}><p className={s.label}>Lesson explanation</p><h3>Pattern · <span lang="fr">Je voudrais</span></h3><p className={s.meta}>“I would like…”</p><p className={s.example} lang="fr">Je voudrais <span className={s.gloss}>un café</span></p><p className={s.finePrint}>a polite request · conditional</p></div>
        <div className={s.slate}><p className={s.label}>Construction</p><h3>I would like a table.</h3><p className={s.meta}>Your turn</p><div lang="fr">{['Je', 'voudrais', 'une', 'table'].map(word => <span className={s.wordChip} key={word}>{word}</span>)}</div><p className={s.finePrint}>Build a sentence. Make it yours.</p></div>
      </div>
    </div></section>
  </>;
}
