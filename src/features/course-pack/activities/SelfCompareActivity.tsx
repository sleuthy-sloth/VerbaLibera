"use client";
import { useState } from 'react';
import { useVoiceRecorder } from '@/lib/use-voice-recorder';
import type { Assistance, Response, SelfCompareActivity as Spec } from '../lesson-runtime';

/**
 * The lesson flow's only speaking step. The learner says the line, hears
 * themselves back, then reveals the model and rates how it went.
 *
 * Recording comes BEFORE the reveal on purpose: producing the line from memory
 * and then comparing is the whole point, and revealing the model first turns
 * this into reading aloud. The recorder is additive — a learner whose browser
 * cannot record, or who denies the microphone, still gets the self-assessment,
 * which is why every branch below degrades to the previous behaviour.
 */
export function SelfCompareActivity({activity, disabled, onChange, onAssist, modelAudioUrl, language}: {
 activity: Spec; disabled: boolean; onChange: (response: Response) => void;
 onAssist: (kind: Assistance) => void; modelAudioUrl?: string;
 /** BCP-47 code of the target language; the model sentence is always in it. */
 language?: string;
}) {
 const [revealed,setRevealed]=useState(false);
 const { state, recordingUrl, start, stop, discard, canRecord } = useVoiceRecorder();

 return <div>
  <p>Say your answer, then compare it with the model. This is self-assessed practice.</p>

  {canRecord && <div className="lp-record">
   {recordingUrl ? <>
    <audio controls preload="metadata" src={recordingUrl} aria-label="Your recording" />
    <div className="lp-record-actions">
     <button type="button" className="lp-secondary" disabled={disabled} onClick={discard}>Record again</button>
    </div>
    <p className="lp-record-note">Hear yourself, then the model. Nothing is uploaded or kept.</p>
   </> : <button
    type="button"
    className="lp-secondary"
    disabled={disabled || state === 'requesting'}
    onClick={state === 'recording' ? stop : start}
    aria-live="polite"
   >{state === 'recording' ? 'Stop recording' : state === 'requesting' ? 'Starting…' : 'Record yourself saying it'}</button>}
  </div>}

  {state === 'denied' && <p className="lp-record-note" role="note">
   Microphone is blocked, so nothing is recorded. Say it out loud anyway and compare with the model.
  </p>}

  {revealed ? <>
   <p className="lp-model" lang={language}>{activity.modelText}</p>
   {modelAudioUrl && <audio controls preload="metadata" src={modelAudioUrl} aria-label="Comparison model audio" />}
   <button type="button" disabled={disabled} onClick={()=>onChange({kind:'self',rating:'again'})}>Practise again</button>
   <button type="button" disabled={disabled} onClick={()=>onChange({kind:'self',rating:'comfortable'})}>Comfortable</button>
  </> : <button type="button" disabled={disabled} onClick={()=>{setRevealed(true);onAssist('model');}}>Reveal comparison model</button>}
 </div>;
}
