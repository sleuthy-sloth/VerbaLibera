// Honest listen logging: finishing a track records that it was heard, with a
// timestamp. It never claims mastery, XP, or proficiency — review and
// practice live in the text path. Browser-local; cleared with site data.
const KEY = "verbalibera_listened";

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as Record<string, string>;
    return {};
  } catch {
    return {};
  }
}

export function listenedAt(lessonId: string): string | null {
  return readAll()[lessonId] ?? null;
}

export function markListened(lessonId: string, at = new Date()): string {
  const iso = at.toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [lessonId]: iso }));
  } catch {
    // Private mode / quota: listening still works, the badge just won't persist.
  }
  return iso;
}
