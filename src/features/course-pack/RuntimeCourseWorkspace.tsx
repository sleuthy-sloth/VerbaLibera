"use client";
import { useEffect, useState, type ReactNode } from 'react';
import type { CourseEnvironment } from './environment';
import type { RuntimePack } from './lesson-runtime';
import { mergeLearningEvents, projectLessonEvidence, type LessonEvidence } from './attempts';
import { LessonPlayer } from './LessonPlayer';
import { OfflineDownload } from './OfflineDownload';
import catalog from './catalog.json';

export function RuntimeCourseWorkspace({pack,environment,scope,language,onLanguageChange,onProgressChanged,accountControls}: {
 pack:RuntimePack; environment:CourseEnvironment; scope:string|null; language:string;
 onLanguageChange:(language:string)=>void; onProgressChanged:()=>void; accountControls?:ReactNode;
}) {
 const [active,setActive]=useState<string|null>(null);
 const [selected,setSelected]=useState<string|null>(null);
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
 if(active) return <main id="main-content" className="study"><LessonPlayer pack={pack} lessonId={active} environment={environment} onExit={()=>{setActive(null);setSelected(null);refreshed();}}/></main>;
 const eligible=(lesson:RuntimePack['lessons'][number])=>!!evidence && lesson.prerequisites.every(p=>{
  if(evidence.legacyCredits.includes(p.lessonId))return true;
  if(p.requirement.kind==='participation')return evidence.participationCompleted.includes(p.lessonId);
  if(p.requirement.kind==='legacy-success')return evidence.legacyCredits.includes(p.lessonId);
  return (evidence.evidence[p.requirement.evidenceKey]?.successes ?? 0)>=p.requirement.successes;
 });
 const complete=(lesson:RuntimePack['lessons'][number])=>!!evidence&&(evidence.participationCompleted.includes(lesson.id)||evidence.legacyCredits.includes(lesson.id));
 const next=pack.lessons.find(lesson=>!complete(lesson)&&eligible(lesson));
 const completeCount=pack.lessons.filter(complete).length;
 return <main id="main-content" className="study">
  <header className="study-header">
   {environment.capabilities.hostedNavigation && <a href="/dashboard">← Daily path</a>}
   <label>Foundation language<select value={language} onChange={e=>onLanguageChange(e.target.value)}>{catalog.map(c=><option key={c.slug} value={c.slug}>{c.title}</option>)}</select></label>
  </header>
  <h1>{pack.title}</h1><p>{pack.description}</p>{accountControls}
  {environment.capabilities.offlineInstall && <OfflineDownload key={language} pack={pack} language={language} environment={environment} />}
  {error && <p role="alert">{error}</p>}
  {!evidence && !error && <p role="status">Reading your saved practice…</p>}
  {selected ? (()=>{const lesson=pack.lessons.find(item=>item.id===selected); if(!lesson)return null; return <section className="study-lesson"><button type="button" onClick={()=>setSelected(null)}>← Course path</button><p className="study-eyebrow">{lesson.family} · about {lesson.estimatedMinutes} minutes</p><h2>{lesson.title}</h2><p>{lesson.objective}</p>{(lesson as typeof lesson & { explanation?: string }).explanation ? <p>{(lesson as typeof lesson & { explanation?: string }).explanation}</p> : null}{((lesson as typeof lesson & { examples?: {target:string;meaning:string}[] }).examples ?? []).map(example=><p className="study-example" key={example.target}><span lang={pack.language}>{example.target}</span> — {example.meaning}</p>)}<button type="button" className="study-primary" disabled={!eligible(lesson)||!environment.lessonPractice||!!error} onClick={()=>setActive(lesson.id)}>Begin practice</button></section>})() : <>
  <nav className="study-path" aria-label="Course path"><div className="study-path-heading"><div><p className="study-eyebrow">Your route</p><h2>Course path</h2><p>Start at the top. Completed lessons stay available for review.</p></div><div className="study-path-progress"><strong>{completeCount} of {pack.lessons.length}</strong><span>lessons practised</span><progress aria-label="Course progress" max={pack.lessons.length} value={completeCount}/></div></div>
  {pack.units.map(unit=><section key={unit.id} className="study-path-unit"><h3>{unit.title}</h3><p>{unit.objective}</p><ol className="study-lessons">{pack.lessons.filter(l=>l.unitId===unit.id).map((lesson,index)=>{const done=complete(lesson), upNext=next?.id===lesson.id, unlocked=eligible(lesson), prerequisite=pack.lessons.find(candidate=>candidate.id===lesson.prerequisites[0]?.lessonId); const status=done?'Complete — select to review':upNext?'Up next — select to start':unlocked?'Ready — select to start':`Locked — complete ${prerequisite?.title??'the preceding lesson'} to unlock`; return <li className={done?'is-complete':upNext?'is-next':'is-locked'} key={lesson.id}><span className="study-path-number" aria-hidden="true">{index+1}</span><button type="button" disabled={!unlocked||!environment.lessonPractice||!!error} onClick={()=>setSelected(lesson.id)}>{lesson.title}</button><span>{status}</span></li>})}</ol></section>)}</nav></>}
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
