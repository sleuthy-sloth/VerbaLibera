"use client";
import { useEffect, useRef, useState } from "react";
import type { ListenTrack } from "@/features/listen/tracks";
import { listenedAt, markListened } from "@/features/listen/listened";
import styles from "./listen-player.module.css";

// Audio-only lesson player. Lock-screen / control-center metadata comes from
// the Media Session API (guarded: jsdom and old browsers lack it). Finishing
// a track marks it listened — heard, not mastered.
export function ListenPlayer({ track, courseTitle }: { track: ListenTrack; courseTitle: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [heard, setHeard] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setHeard(listenedAt(track.lessonId)), 0);
    return () => clearTimeout(timer);
  }, [track.lessonId]);
  useEffect(() => {
    const media = navigator.mediaSession;
    if (!media) return;
    try {
      media.metadata = new MediaMetadata({
        title: `${track.lessonTitle} · audio lesson`,
        artist: "VerbaLibera",
        album: courseTitle,
      });
    } catch {
      // Older browsers: the player still works, just without lock-screen art.
    }
  }, [track.lessonId, track.lessonTitle, courseTitle]);
  return (
    <section aria-label={`Audio lesson: ${track.lessonTitle}`} className={styles.player}>
      <h2>{track.lessonTitle}</h2>
      <p className={styles.lede}>
        Listen and think — predict each answer aloud before the reveal. No
        typing, no score. About {Math.round(track.durationS / 60)} minutes.
      </p>
      {heard ? (
        <p role="status" className={styles.heard}>
          Listened{heard ? ` · last finished ${new Date(heard).toLocaleDateString()}` : ""}. Replay anytime; text practice locks it in.
        </p>
      ) : null}
      <audio
        ref={audio}
        controls
        preload="none"
        src={track.audioUrl}
        aria-label={`Play the audio lesson: ${track.lessonTitle}`}
        onEnded={() => setHeard(markListened(track.lessonId))}
        className={styles.audio}
      />
      <details className={styles.transcript}>
        <summary>Read along (transcript)</summary>
        {track.sections.map((s) => (
          <div key={s.heading}>
            <h3>{s.heading}</h3>
            <p>{s.teacher}</p>
            {s.target ? (
              <p>
                <strong>{s.target.text}</strong> — {s.target.meaning}
              </p>
            ) : null}
          </div>
        ))}
      </details>
    </section>
  );
}
