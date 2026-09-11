"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListenTrack } from "@/features/listen/tracks";
import { langCodeFor } from "@/features/course-pack/language-code";
import { PLAYER_COVER, PLAYER_SQUARE, playerArtwork } from "@/features/listen/player-art";
import { listenedAt, markListened } from "@/features/listen/listened";
import {
  clearPosition,
  readPosition,
  savePosition,
} from "@/features/listen/position";
import styles from "./listen-player.module.css";

/** `183.4` → `3:03`. Used for the resume state and the transport readout. */
export function formatPosition(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

/** How far the skip buttons move. Long enough to matter, short enough to be safe. */
export const SKIP_SECONDS = 15;
/** Playback speeds offered. 1 is first: it is the default and the honest one. */
export const PLAYBACK_RATES = [1, 0.75, 1.25, 1.5] as const;

// Audio-only lesson player: a Warm Studio card around a native audio element.
// Lock-screen / control-center metadata comes from the Media Session API
// (guarded: jsdom and old browsers lack it). Finishing a track marks it
// listened — heard, not mastered.
//
// Quitting halfway used to lose the place, which for an eleven-minute track is
// the difference between finishing it and never opening it again. The player
// remembers where the learner stopped (browser-local, see
// `src/features/listen/position.ts`), says so before playing, and offers to
// start over.
//
// The card renders its own transport — play/pause, ±15s, a scrubber, speed —
// because a phone's native bar is a thin strip with a thumb you cannot hit
// while walking. The `<audio controls>` element is still the layer everything
// actually runs through and stays in the accessible tree as the fallback: the
// custom controls only call into it. Nothing here touches the audio URL, the
// service worker's caching or the stored position.
export function ListenPlayer({
  track,
  courseTitle,
  lessonTitle,
  coverUrl,
  resolveMedia = (url) => url,
}: {
  track: ListenTrack;
  courseTitle: string;
  lessonTitle?: string;
  /**
   * The course banner, already resolved by the edition (a plain path hosted and
   * downloaded, an embedded blob in the portable file). It is what the lock
   * screen and the notification shade show while the track plays — the surface a
   * learner actually looks at when they are walking and the screen is off.
   */
  coverUrl?: string;
  /**
   * How this edition turns a shipped path into something the browser can fetch.
   * Hosted and downloaded editions leave it alone; the portable single file
   * swaps in its embedded blob URL. The player draws two files of its own
   * (`player-art.ts`), so it needs the same resolver the audio and the banner
   * already travel through.
   */
  resolveMedia?: (url: string) => string;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const [resumedTo, setResumedTo] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(track.durationS);
  const [rate, setRate] = useState<number>(1);
  const [savedOffline, setSavedOffline] = useState<boolean | null>(null);
  const [online, setOnline] = useState(true);
  const applied = useRef(false);
  const lastSaved = useRef(0);
  // The lesson the learner picked names the player. The track's own label
  // describes the recording, so it is only the fallback when the course has
  // not loaded yet.
  const title = lessonTitle ?? track.lessonTitle;
  // The mark is the language, not decoration: a learner with two courses open
  // can tell at a glance which one is playing. Falls back to the slug's first
  // two letters so a new course is never marked with nothing.
  const language = (langCodeFor(track.courseSlug) ?? track.courseSlug.slice(0, 2)).toUpperCase();

  useEffect(() => {
    const timer = setTimeout(() => {
      setHeard(listenedAt(track.lessonId));
      setResumeFrom(readPosition(track.lessonId));
      setResumedTo(null);
      setPlaying(false);
      setCurrent(0);
      setDuration(track.durationS);
      applied.current = false;
      setOnline(navigator.onLine !== false);
    }, 0);
    return () => clearTimeout(timer);
  }, [track.lessonId, track.durationS]);

  // Is this track already on the device? The same Cache Storage the service
  // worker reads, so "saved" here means what it means offline. Never a claim
  // about the lesson — only about the file.
  useEffect(() => {
    let active = true;
    const check = async (): Promise<void> => {
      if (!("caches" in globalThis)) {
        if (active) setSavedOffline(false);
        return;
      }
      try {
        const hit = await caches.match(track.audioUrl);
        if (active) setSavedOffline(Boolean(hit));
      } catch {
        if (active) setSavedOffline(false);
      }
    };
    void check();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [track.audioUrl]);

  const persist = useCallback(() => {
    const element = audio.current;
    if (!element) return;
    lastSaved.current = element.currentTime;
    const kept = savePosition(track.lessonId, element.currentTime, element.duration);
    if (kept === null) setResumeFrom(null);
  }, [track.lessonId]);

  // A tab that is closed or backgrounded is the common way to leave a long
  // track, and `pause` does not always fire first.
  useEffect(() => {
    const onHide = () => persist();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [persist]);

  useEffect(() => {
    const media = navigator.mediaSession;
    if (!media) return;
    try {
      media.metadata = new MediaMetadata({
        title: `${title} · audio lesson`,
        artist: "VerbaLibera",
        album: courseTitle,
        // Artwork is advisory: a platform that cannot fetch it still shows the
        // three lines above.
        artwork: playerArtwork(resolveMedia(PLAYER_SQUARE.url), coverUrl),
      });
    } catch {
      // Older browsers: the player still works, just without lock-screen art.
    }
  }, [track.lessonId, title, courseTitle, coverUrl, resolveMedia]);

  const seekTo = (value: number): void => {
    const element = audio.current;
    if (!element) return;
    // Past the end of a re-encoded file the element clamps, but the readout
    // would keep the number the learner dragged to, so clamp here too.
    const target = Math.min(Math.max(0, value), duration);
    element.currentTime = target;
    setCurrent(target);
  };

  // Relative moves read the element, not the React state: the position the
  // learner is actually at is the element's, and a state value can be a tick
  // behind it.
  const nudge = (delta: number): void => {
    const element = audio.current;
    if (!element) return;
    seekTo(element.currentTime + delta);
  };

  const togglePlay = (): void => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) {
      void element.play().catch(() => {
        // A blocked play() (no user gesture, or a decode failure) leaves the
        // button in the paused state, which is the truth.
        setPlaying(false);
      });
    } else {
      element.pause();
    }
  };

  const offlineState = (() => {
    if (savedOffline === null) return "Checking this device…";
    if (savedOffline) return "Saved on this device — this track plays with no connection.";
    if (!online) return "You are offline and this track is not saved on this device yet.";
    return "Not saved on this device yet — save it below to listen with no connection.";
  })();

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <section aria-label={`Audio lesson: ${title}`} className={styles.player}>
      <header className={styles.head}>
        {/* Decorative: the heading beside it names the lesson, and the transport
         * below names its state, so this carries no information and no alt text. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- also bundled outside Next for offline cold starts */}
        <img
          alt=""
          className={styles.cover}
          height={PLAYER_COVER.height}
          src={resolveMedia(PLAYER_COVER.url)}
          width={PLAYER_COVER.width}
        />
        <div className={styles.headRow}>
          <span className={styles.mark} aria-hidden="true">
            {language}
          </span>
          <div className={styles.headText}>
            <h2>{title}</h2>
            <p className={styles.meta}>
              {courseTitle} · {formatPosition(track.durationS)} · audio only
            </p>
          </div>
        </div>
      </header>

      {track.reviewPending ? (
        <p className={styles.note}>Machine-recorded. A native-speaker check is still pending.</p>
      ) : null}
      <p className={styles.lede}>
        Listen and think — predict each answer aloud before the reveal. No typing, no score.
      </p>

      {heard ? (
        <p role="status" className={styles.heard}>
          Listened {new Date(heard).toLocaleDateString()}. Heard, not mastered — replay any time.
        </p>
      ) : null}

      {resumeFrom !== null ? (
        <p role="status" className={styles.resumed}>
          <strong className={styles.resumeState}>
            {resumedTo !== null
              ? `Resumed at ${formatPosition(resumedTo)}`
              : `Resume from ${formatPosition(resumeFrom)}`}
          </strong>
          {resumedTo !== null ? ". " : " — this picks up where you stopped. "}
          <button
            type="button"
            className={styles.startOver}
            onClick={() => {
              clearPosition(track.lessonId);
              setResumeFrom(null);
              setResumedTo(null);
              applied.current = true;
              seekTo(0);
            }}
          >
            Start over
          </button>
        </p>
      ) : null}

      <div className={styles.transport}>
        <button
          type="button"
          className={styles.skip}
          onClick={() => nudge(-SKIP_SECONDS)}
        >
          <span aria-hidden="true">−{SKIP_SECONDS}s</span>
          <span className={styles.srOnly}>Back {SKIP_SECONDS} seconds</span>
        </button>
        <button
          type="button"
          className={styles.play}
          // Short, role-specific label: the card's heading above already names
          // the lesson, and the audio element below carries the long label for
          // assistive tech that reaches the media element directly.
          aria-label={playing ? "Pause the audio lesson" : "Play the audio lesson"}
          onClick={togglePlay}
        >
          <span
            aria-hidden="true"
            className={playing ? styles.glyphPause : styles.glyphPlay}
          />
        </button>
        <button
          type="button"
          className={styles.skip}
          onClick={() => nudge(SKIP_SECONDS)}
        >
          <span aria-hidden="true">+{SKIP_SECONDS}s</span>
          <span className={styles.srOnly}>Forward {SKIP_SECONDS} seconds</span>
        </button>
      </div>

      <div className={styles.scrubWrap}>
        <div className={styles.scrubTrack} aria-hidden="true">
          <div className={styles.scrubFill} style={{ width: `${progress}%` }} />
        </div>
        <input
          type="range"
          className={styles.scrub}
          min={0}
          max={Math.max(1, Math.round(duration))}
          step={1}
          value={Math.min(Math.round(current), Math.max(1, Math.round(duration)))}
          aria-label={`Seek within the audio lesson: ${title}`}
          aria-valuetext={`${formatPosition(current)} of ${formatPosition(duration)}`}
          onChange={(event) => seekTo(Number(event.target.value))}
        />
        <p className={styles.times}>
          <span>{formatPosition(current)}</span>
          <span>{formatPosition(duration)}</span>
        </p>
      </div>

      <div className={styles.settings}>
        <label className={styles.speed}>
          Speed
          <select
            value={String(rate)}
            onChange={(event) => {
              const next = Number(event.target.value);
              setRate(next);
              const element = audio.current;
              if (element) element.playbackRate = next;
            }}
          >
            {PLAYBACK_RATES.map((value) => (
              <option key={value} value={String(value)}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <p
          className={styles.offlineState}
          data-saved={savedOffline === true ? "yes" : savedOffline === false ? "no" : "checking"}
        >
          {offlineState}
        </p>
      </div>

      {/*
        The native element: what actually plays, what the custom controls call
        into, and what a browser without our JavaScript falls back to. It keeps
        `controls` so it stays independently operable, and is visually hidden by
        the card's own transport rather than removed.
      */}
      <audio
        ref={audio}
        controls
        preload="metadata"
        src={track.audioUrl}
        aria-label={`Play the audio lesson: ${title}`}
        className={styles.audio}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          persist();
        }}
        onLoadedMetadata={() => {
          const element = audio.current;
          if (!element) return;
          if (Number.isFinite(element.duration)) setDuration(element.duration);
          element.playbackRate = rate;
          if (applied.current || resumeFrom === null) return;
          // A saved position past the end of a re-encoded track would strand
          // the learner at the end of the file.
          if (Number.isFinite(element.duration) && resumeFrom >= element.duration) {
            clearPosition(track.lessonId);
            setResumeFrom(null);
            return;
          }
          element.currentTime = resumeFrom;
          applied.current = true;
          setCurrent(resumeFrom);
          setResumedTo(resumeFrom);
        }}
        onDurationChange={() => {
          const element = audio.current;
          if (element && Number.isFinite(element.duration)) setDuration(element.duration);
        }}
        onTimeUpdate={() => {
          const element = audio.current;
          if (!element) return;
          setCurrent(element.currentTime);
          // Cheap throttle: the store does not need five writes a second.
          if (Math.abs(element.currentTime - lastSaved.current) < 5) return;
          persist();
        }}
        onSeeked={() => {
          const element = audio.current;
          if (element) setCurrent(element.currentTime);
          persist();
        }}
        onEnded={() => {
          clearPosition(track.lessonId);
          setResumeFrom(null);
          setResumedTo(null);
          setPlaying(false);
          setHeard(markListened(track.lessonId));
        }}
      />

      <p className={styles.saveRow}>
        <a href={track.audioUrl} download>
          Save audio for offline listening
        </a>
      </p>

      <details className={styles.transcript}>
        <summary>Read along (transcript)</summary>
        {track.sections.map((s) => (
          <div key={s.heading}>
            <h3>{s.heading}</h3>
            <p>{s.teacher}</p>
            {s.target ? (
              <p>
                <strong lang={langCodeFor(track.courseSlug)}>{s.target.text}</strong> — {s.target.meaning}
              </p>
            ) : null}
          </div>
        ))}
      </details>
    </section>
  );
}
