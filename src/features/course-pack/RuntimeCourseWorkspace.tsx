"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Also bundled outside Next for offline cold starts. */
/* Public offline entry shares this component. Keep Next/account imports out. */
import { useEffect, useState, type ReactNode } from 'react';
import type { CourseEnvironment } from './environment';
import type { RuntimePack } from './lesson-runtime';
import { mergeLearningEvents, projectLessonEvidence, type LessonEvidence } from './attempts';
import { LessonPlayer } from './LessonPlayer';
import { DialogueView } from './DialogueView';
import { OfflineDownload } from './OfflineDownload';
import catalog from './catalog.json';

/**
 * The v2 course workspace.
 *
 * Two shells, deliberately:
 *  - the course shell (below) carries the language switcher, the download
 *    panel, the account controls, the backup export and the course path;
 *  - the lesson shell carries one lesson and one way out.
 *
 * The lesson used to render inside the course shell, which put a storage-scope
 * paragraph, a PWA install manual and an account panel above the thing the
 * learner came to do, and left `?start=1` landing mid-scroll on a 3,300px page
 * with no sticky context.
 */
export function RuntimeCourseWorkspace({pack,environment,scope,language,onLanguageChange,onProgressChanged,accountControls,startNextLesson=false}: {
 pack:RuntimePack; environment:CourseEnvironment; scope:string|null; language:string;
 onLanguageChange:(language:string)=>void; onProgressChanged:()=>void; accountControls?:ReactNode;
 startNextLesson?:boolean;
}) {
 const [active,setActive]=useState<string|null>(null);
 const [selected,setSelected]=useState<string|null>(null);
 const [evidence,setEvidence]=useState<LessonEvidence|null>(null);
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 const [durability,setDurability]=useState(environment.practice.getDurability());
 useEffect(()=>environment.practice.subscribeDurability(setDurability),[environment.practice]);
 useEffect(()=>{
  let current=true;
  Promise.all([environment.practice.read(scope),environment.lessonPractice?.readLessons() ?? Promise.resolve([])])
   .then(([old,events])=>{if(current){
   const projected=projectLessonEvidence(pack,mergeLearningEvents(old,events));
   setEvidence(projected);
   setError('');
   // Entry from the dashboard / onboarding CTA. Previously only the legacy (v1)
   // course honoured `?start=1`, so the same button behaved differently per
   // language. Choosing it here — rather than scrolling a 3,000px course page to
   // the lesson — is what makes the handoff land somewhere deliberate.
   if(startNextLesson){
    const firstOpen=pack.lessons.find(lesson=>lesson.prerequisites.every(p=>{
      if(projected.legacyCredits.includes(p.lessonId))return true;
      if(p.requirement.kind==='participation')return projected.participationCompleted.includes(p.lessonId);
      if(p.requirement.kind==='legacy-success')return projected.legacyCredits.includes(p.lessonId);
      return (projected.evidence[p.requirement.evidenceKey]?.successes ?? 0)>=p.requirement.successes;
    })&&!(projected.participationCompleted.includes(lesson.id)||projected.legacyCredits.includes(lesson.id)));
    if(firstOpen)setSelected(firstOpen.id);
   }
  }})
   .catch(e=>{if(current)setError(e instanceof Error?e.message:'Could not read saved practice.');});
  return()=>{current=false;};
 },[pack,environment,scope,revision,startNextLesson]);
 const refreshed=()=>{setRevision(value=>value+1);onProgressChanged();};
 const eligible=(lesson:RuntimePack['lessons'][number])=>!!evidence && lesson.prerequisites.every(p=>{
  if(evidence.legacyCredits.includes(p.lessonId))return true;
  if(p.requirement.kind==='participation')return evidence.participationCompleted.includes(p.lessonId);
  if(p.requirement.kind==='legacy-success')return evidence.legacyCredits.includes(p.lessonId);
  return (evidence.evidence[p.requirement.evidenceKey]?.successes ?? 0)>=p.requirement.successes;
 });
 const complete=(lesson:RuntimePack['lessons'][number])=>!!evidence&&(evidence.participationCompleted.includes(lesson.id)||evidence.legacyCredits.includes(lesson.id));
 const next=pack.lessons.find(lesson=>!complete(lesson)&&eligible(lesson));
 const completeCount=pack.lessons.filter(complete).length;

 if(active) return <main id="main-content" className="study"><LessonPlayer pack={pack} lessonId={active} environment={environment} onExit={()=>{setActive(null);setSelected(null);refreshed();}}/></main>;

 if(selected){
  const lesson=pack.lessons.find(item=>item.id===selected);
  if(lesson){
   const canStart=eligible(lesson)&&!!environment.lessonPractice&&!error;
   return <main id="main-content" className="study study-focused">
    <button type="button" className="study-back" onClick={()=>setSelected(null)}>
     <span aria-hidden="true">←</span> Back to the course
    </button>
    <p className="study-eyebrow">{lesson.family} · about {lesson.estimatedMinutes} minutes</p>
    <h1>{lesson.title}</h1>
    <p>{lesson.objective}</p>
    {(lesson as typeof lesson & { explanation?: string }).explanation ? <p>{(lesson as typeof lesson & { explanation?: string }).explanation}</p> : null}
    {((lesson as typeof lesson & { examples?: {target:string;meaning:string}[] }).examples ?? []).map(example=>
     <p className="study-example" key={example.target}><span lang={pack.language}>{example.target}</span> — {example.meaning}</p>)}
    {!eligible(lesson) ? (
     <p className="study-locked-note">This lesson opens once you have finished the one before it.</p>
    ) : null}
    <button type="button" className="study-primary study-primary-large" disabled={!canStart} onClick={()=>setActive(lesson.id)}>Begin practice</button>
    {error ? <p role="alert">{error}</p> : null}
   </main>;
  }
 }
 return <main id="main-content" className="study">
  <header className="study-header">
   {environment.capabilities.hostedNavigation && <a href="/dashboard"><span aria-hidden="true">←</span> Today</a>}
   <label>Learning language<select value={language} onChange={e=>onLanguageChange(e.target.value)}>{catalog.map(c=><option key={c.slug} value={c.slug}>{c.title}</option>)}</select></label>
  </header>
  <h1>{pack.title}</h1><p className="study-lede">{pack.description}</p>
  {durability === "temporary" && (
   <p role="alert">Progress is temporary in this browser. Export a backup before closing this file.</p>
  )}
  {error && <p role="alert">{error}</p>}
  {!evidence && !error && <p role="status">Reading your saved practice…</p>}
  {evidence ? (
   <nav className="study-path" aria-label="Course path">
    <div className="study-path-heading"><div><h2>Course path</h2><p>Start at the top. Completed lessons stay available for review.</p></div><div className="study-path-progress"><strong>{completeCount} of {pack.lessons.length}</strong><span>lessons practised</span><progress aria-label="Course progress" max={pack.lessons.length} value={completeCount}/></div></div>
    {pack.units.map(unit=><section key={unit.id} className="study-path-unit"><h3>{unit.title}</h3><p>{unit.objective}</p><ol className="study-lessons">{pack.lessons.filter(l=>l.unitId===unit.id).map((lesson,index)=>{const done=complete(lesson), upNext=next?.id===lesson.id, unlocked=eligible(lesson), prerequisite=pack.lessons.find(candidate=>candidate.id===lesson.prerequisites[0]?.lessonId); const status=done?'Complete — select to review':upNext?'Up next — select to start':unlocked?'Ready — select to start':`After ${prerequisite?.title??'the previous lesson'}`; const state=done?'is-complete':upNext?'is-next':unlocked?'is-ready':'is-locked'; return <li className={state} key={lesson.id}><span className="study-path-number" aria-hidden="true">{index+1}</span><button type="button" disabled={!unlocked||!environment.lessonPractice||!!error} onClick={()=>setSelected(lesson.id)}>{lesson.title}</button><span className={state==='is-locked'?'study-lock':undefined}>{state==='is-locked'?<><span aria-hidden="true">🔒</span>{status}</>:status}</span></li>})}</ol></section>)}
   </nav>
  ) : null}
  {pack.dialogues.length > 0 ? (
   /**
    * The v2 shell had no dialogue surface, so a migrated course's scripted
    * conversations sat in the pack unreachable: `DialogueView` was rendered only
    * by the legacy shell. The guard is content, not progress — a dialogue's
    * choices are explored freely and are not saved as mastery — and the
    * prerequisite is named rather than enforced, because the point of a
    * recovery-branch conversation is to try it and get it wrong safely.
    */
   <section className="study-dialogues" aria-labelledby="dialogues-heading">
    <h2 id="dialogues-heading">Use it in a conversation</h2>
    <p>Original scripted conversations with recovery branches. Explore freely; choices here are not saved as mastery.</p>
    {pack.dialogues.map(dialogue=><div className="study-dialogue" key={dialogue.id}>
     <p className="study-dialogue-prerequisite">Study first: {pack.lessons.find(l=>l.id===dialogue.prerequisite)?.title ?? 'the lesson before it'}</p>
     <DialogueView dialogue={dialogue} language={pack.language}/>
    </div>)}
   </section>
  ) : null}
  {environment.capabilities.offlineInstall ? <OfflineDownload key={language} pack={pack} language={language} environment={environment} /> : null}
  {accountControls ?? null}
  {environment.backup && <section className="study-backup">
   <h2>Keep a practice backup</h2>
   <p>Export your practice to restore it later or move it to another device. Practice kept in this browser and practice kept on an account are separate.</p>
   <button type="button" onClick={async()=>{try{
    const url=URL.createObjectURL(new Blob([JSON.stringify(await environment.backup!.export(),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='verbalibera-practice.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   }catch(e){setError(e instanceof Error?e.message:'Could not export practice.');}}}>Export practice backup</button>
   <label>Import practice backup<input type="file" accept="application/json" aria-label="Import practice backup file" onChange={async e=>{
    const input=e.currentTarget,file=input.files?.[0];if(!file)return;
    try{await environment.backup!.import(await file.text());refreshed();}catch(error){setError(error instanceof Error?error.message:'Import failed.');}finally{input.value='';}
   }}/></label>
  </section>}
  {evidence ? (
   <details className="study-extras"><summary>Grammar and vocabulary</summary>
    {pack.concepts.map(c=><section key={c.id}><h3>{c.title}</h3><p>{c.explanation}</p>{c.examples.map(e=><p key={e.target}><span lang={pack.language}>{e.target}</span> — {e.meaning}</p>)}</section>)}
    <dl>{pack.vocabulary.map(v=><div key={v.id}><dt lang={pack.language}>{v.word}</dt><dd>{v.meaning}</dd></div>)}</dl>
   </details>
  ) : null}
  <p className="study-provenance">Original VerbaLibera authoring, 2026. {pack.lessons.length} lessons, machine-authored and consistency-checked; native-speaker editorial review is still open. <a href="/courses">See every course</a>.</p>
 </main>;
}
