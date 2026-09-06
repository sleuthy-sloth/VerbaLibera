import { SentenceBuilderDemo } from './SentenceBuilderDemo';
import s from './landing.module.css';

const steps = [
  ['Notice', 'See the pattern in context, with a plain-English gloss beside it.', 'Je voudrais + noun', '“I would like…”'],
  ['Build', 'Understand the parts before you memorise the whole — subject, verb, the shape of a clause.', 'Je voudrais', '= “I would like” · polite, not a command'],
  ['Vary', 'Swap vocabulary and structure to make it yours, not a fixed flashcard.', '… un café → une table → un livre', 'the noun changes, the pattern holds'],
  ['Use', 'Produce the language yourself, then compare with a model answer.', 'Je voudrais un livre, s’il vous plaît.', 'Spaced review brings it back when it starts to slip.'],
];

export function LearningMethod() {
  return <>
    <section className={s.section} aria-labelledby="demo-heading"><div className={s.container}>
      <div className={s.sectionHead}><p className={s.eyebrow}>The practice loop</p><h2 id="demo-heading">One pattern. One sentence.<br /> That’s the lesson.</h2><p>See a pattern, follow a worked example, then make a sentence of your own. Recognition helps you get started; construction puts the language in your hands.</p></div>
      <SentenceBuilderDemo /><p className={s.finePrint}>Try the pattern here. Foundation exercises check your answers on your device.</p>
    </div></section>
    <section className={s.section} id="method" aria-labelledby="method-heading"><div className={s.container}>
      <div className={s.sectionHead}><p className={s.eyebrow}>The method</p><h2 id="method-heading">Notice it. Build it.<br /> Vary it. Use it.</h2><p>Four moves, in order. Each one hands the language to you a little sooner than the last.</p></div>
      <ol className={s.method}>{steps.map(([title, description, example, note], i) => <li key={title}><span className={s.methodNumber} aria-hidden="true">0{i + 1}</span><div><h3>{title}</h3><p>{description}</p><div className={s.methodExample}><span lang="fr">{example}</span> <span className={s.gloss}>{note}</span></div></div></li>)}</ol>
    </div></section>
    <section className={s.section} id="philosophy" aria-labelledby="philosophy-heading"><div className={s.container}>
      <div className={`${s.sectionHead} ${s.wideHead}`}><p className={s.eyebrow}>Philosophy</p><h2 id="philosophy-heading">Your language app<br /> shouldn’t be disappointed in you.</h2><p>Learning takes time. VerbaLibera doesn’t punish you for taking it. No streaks to break, no timer forcing you to hurry, no meter you’re failing.</p></div>
      <ul className={s.noList}>{['streak anxiety.', 'lives.', 'countdown.', 'fake urgency.'].map(text => <li key={text}><span>No</span><span>{text}</span></li>)}</ul><p className={s.returnLine}>Just lessons worth returning to.</p>
    </div></section>
  </>;
}
