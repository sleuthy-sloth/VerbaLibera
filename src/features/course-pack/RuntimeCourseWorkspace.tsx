"use client";
import { useEffect, useState, type ReactNode } from 'react';
import type { CourseEnvironment } from './environment';
import type { RuntimePack } from './lesson-runtime';
import { mergeLearningEvents, projectLessonEvidence, type LessonEvidence } from './attempts';
import { LessonPlayer } from './LessonPlayer';
import catalog from './catalog.json';

export function RuntimeCourseWorkspace({pack,environment,scope,language,onLanguageChange,onProgressChanged,accountControls}: {
 pack:RuntimePack; environment:CourseEnvironment; scope:string|null; language:string;
 onLanguageChange:(language:string)=>void; onProgressChanged:()=>void; accountControls?:ReactNode;
}) {
 const [active,setActive]=useState<string|null>(null);
 const [evidence,setEvidence]=useState<LessonEvidence|null>(null);
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let current=true;
  Promise.all([environment.practice.read(scope),environment.lessonPractice?.readLessons() ?? Promise.resolve([])])
   .then(([old,events])=>{if(current){setEvidence(projectLessonEvidence(pack,mergeLearningEvents(old,events)));setError('');}})
   .catch(e=>{if(current)setError(e instanceof Error?e.message:'Could not read saved practice.');});
  return()=>{current=false;};
 },[pack,environment,scope,revision]);
 const refreshed=()=>{setRevision(value=>value+1);onProgressChanged();};
 if(active) return <main id="main-content" className="study"><LessonPlayer pack={pack} lessonId={active} environment={environment} onExit={()=>{setActive(null);refreshed();}}/></main>;
 const eligible=(lesson:RuntimePack['lessons'][number])=>!!evidence && lesson.prerequisites.every(p=>{
  if(evidence.legacyCredits.includes(p.lessonId))return true;
  if(p.requirement.kind==='participation')return evidence.participationCompleted.includes(p.lessonId);
  if(p.requirement.kind==='legacy-success')return evidence.legacyCredits.includes(p.lessonId);
  return (evidence.evidence[p.requirement.evidenceKey]?.successes ?? 0)>=p.requirement.successes;
 });
 return <main id="main-content" className="study">
  <header className="study-header">
   {environment.capabilities.hostedNavigation && <a href="/dashboard">← Daily path</a>}
   <label>Foundation language<select value={language} onChange={e=>onLanguageChange(e.target.value)}>{catalog.map(c=><option key={c.slug} value={c.slug}>{c.title}</option>)}</select></label>
  </header>
  <h1>{pack.title}</h1><p>{pack.description}</p>{accountControls}
  {error && <p role="alert">{error}</p>}
  {!evidence && !error && <p role="status">Reading your saved practice…</p>}
  {pack.units.map(unit=><section key={unit.id}><h2>{unit.title}</h2><p>{unit.objective}</p>
   {pack.lessons.filter(l=>l.unitId===unit.id).map(lesson=><article className="study-lesson" key={lesson.id}>
    <p className="study-eyebrow">{lesson.family} · about {lesson.estimatedMinutes} minutes</p>
    <h3>{lesson.title}</h3><p>{lesson.objective}</p>
    {evidence?.participationCompleted.includes(lesson.id) && <p>Practised</p>}
    {evidence?.legacyCredits.includes(lesson.id) && <p>Previous completion preserved</p>}
    <button type="button" className="study-primary" disabled={!eligible(lesson)||!environment.lessonPractice||!!error} onClick={()=>setActive(lesson.id)}>Start {lesson.title}</button>
   </article>)}
  </section>)}
  <details><summary>Grammar and vocabulary</summary>
   {pack.concepts.map(c=><section key={c.id}><h3>{c.title}</h3><p>{c.explanation}</p>{c.examples.map(e=><p key={e.target}><span lang={pack.language}>{e.target}</span> — {e.meaning}</p>)}</section>)}
   <dl>{pack.vocabulary.map(v=><div key={v.id}><dt lang={pack.language}>{v.word}</dt><dd>{v.meaning}</dd></div>)}</dl>
  </details>
  {environment.backup && <section><h2>Keep a practice backup</h2>
   <button type="button" onClick={async()=>{try{
    const url=URL.createObjectURL(new Blob([JSON.stringify(await environment.backup!.export(),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='verbalibera-practice.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   }catch(e){setError(e instanceof Error?e.message:'Could not export practice.');}}}>Export practice backup</button>
   <label>Import practice backup<input type="file" accept="application/json" onChange={async e=>{
    const input=e.currentTarget,file=input.files?.[0];if(!file)return;
    try{await environment.backup!.import(await file.text());refreshed();}catch(error){setError(error instanceof Error?error.message:'Import failed.');}finally{input.value='';}
   }}/></label>
  </section>}
 </main>;
}
