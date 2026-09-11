// Where the learner stopped in a long track, so Listen can resume instead of
// starting the same eleven minutes again. Browser-local, like every other
// practice record here, and it never claims progress: a position is not
// listening, and listening is not mastery.
//
// Two rules keep the stored value honest rather than merely present:
//
//   - a position under MIN_RESUME_SECONDS is not a resume point, it is a stray
//     tap, and it is dropped rather than offered back;
//   - a position within COMPLETE_WITHIN_SECONDS of the end is a finished track,
//     so it is cleared instead of resuming the learner into the last few seconds
//     of something they already heard.
const KEY_PREFIX = "verbalibera_listen_position:";

/** Below this a saved position is noise. */
export const MIN_RESUME_SECONDS = 5;
/** At or within this of the end, the track counts as finished. */
export const COMPLETE_WITHIN_SECONDS = 10;

/**
 * Session-only mirror, for the browsers that throw on every storage access
 * (Safari private mode, denied site data). Same rule as onboarding's: the mirror
 * is only ever written when a real write failed, so clearing site data cannot
 * leave a stale copy behind.
 */
const memory = new Map<string, number>();

export function positionKey(lessonId: string): string {
  return `${KEY_PREFIX}${lessonId}`;
}

function write(lessonId: string, seconds: number | null): void {
  const key = positionKey(lessonId);
  try {
    if (seconds === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(seconds));
    memory.delete(key);
  } catch {
    if (seconds === null) memory.delete(key);
    else memory.set(key, seconds);
  }
}

/**
 * The stored resume point, or null when there is none. A value that is missing,
 * unparsable, negative or too small to be a real resume point reads as null —
 * the player must never offer to resume somewhere meaningless.
 */
export function readPosition(lessonId: string): number | null {
  const key = positionKey(lessonId);
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = memory.has(key) ? String(memory.get(key)) : null;
  }
  if (raw === null) return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < MIN_RESUME_SECONDS) return null;
  return seconds;
}

/**
 * Records where the learner is. Returns the position that should be offered
 * back next time: `null` once the track is effectively finished, which is also
 * what clears the stored value.
 */
export function savePosition(
  lessonId: string,
  seconds: number,
  duration: number,
): number | null {
  if (!Number.isFinite(seconds) || seconds < MIN_RESUME_SECONDS) return null;
  if (Number.isFinite(duration) && duration > 0 && seconds >= duration - COMPLETE_WITHIN_SECONDS) {
    clearPosition(lessonId);
    return null;
  }
  const rounded = Math.floor(seconds);
  write(lessonId, rounded);
  return rounded;
}

export function clearPosition(lessonId: string): void {
  write(lessonId, null);
}
