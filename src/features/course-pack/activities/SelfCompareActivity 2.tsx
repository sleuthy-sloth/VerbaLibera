"use client";
import { useState } from 'react';
import type { Assistance, Response, SelfCompareActivity as Spec } from '../lesson-runtime';
export function SelfCompareActivity({activity, disabled, onChange, onAssist, modelAudioUrl, language}: {
 activity: Spec; disabled: boolean; onChange: (response: Response) => void;
 onAssist: (kind: Assistance) => void; modelAudioUrl?: string;
 /** BCP-47 code of the target language; the model sentence is always in it. */
 language?: string;
}) {
 const [revealed,setRevealed]=useState(false);
 return <div>
  <p>Say your answer, then compare it with the model. This is self-assessed practice.</p>
  {revealed ? <>
   <p className="lp-model" lang={language}>{activity.modelText}</p>
   {modelAudioUrl && <audio controls preload="metadata" src={modelAudioUrl} aria-label="Comparison model audio" />}
   <button type="button" disabled={disabled} onClick={()=>onChange({kind:'self',rating:'again'})}>Practise again</button>
   <button type="button" disabled={disabled} onClick={()=>onChange({kind:'self',rating:'comfortable'})}>Comfortable</button>
  </> : <button type="button" disabled={disabled} onClick={()=>{setRevealed(true);onAssist('model');}}>Reveal comparison model</button>}
 </div>;
}
