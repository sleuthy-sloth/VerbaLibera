'use client';

import { useRef } from 'react';
import s from './landing.module.css';

export function ListeningSample() {
  const audio = useRef<HTMLAudioElement>(null);
  return <div className={s.board}>
    <div className={s.boardHead}><span className={s.label}>Listen, then say it</span><span className={s.meta}>French · ordering politely</span></div>
    <div className={s.waveform} aria-hidden="true">{Array.from({ length: 32 }, (_, i) => <span key={i} />)}</div>
    <audio ref={audio} controls preload="metadata" aria-label="French model pronunciation" src="/audio/french-ordering/fr-ordering-politely-answer.wav" />
    <label className={s.speed}>Playback speed <select defaultValue="1" onChange={event => { if (audio.current) audio.current.playbackRate = Number(event.target.value); }}><option value="0.8">Slow · 0.8×</option><option value="1">Normal · 1×</option></select></label>
    <p className={s.boardFoot} lang="fr">Je voudrais un café, s’il vous plaît.</p>
  </div>;
}
