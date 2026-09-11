import rawCatalog from "./catalog.json";

/**
 * The shipped long-form audio, as measured at build time.
 *
 * `scripts/content/listen.ts` generates this file from the mp3s on disk, and
 * `npm run content:build` writes it, so the size a learner is shown and the
 * digest a download verifies are both measurements of the files that exist —
 * never a number a document remembers. `tests/listen-catalog.test.ts` fails if
 * the committed catalog drifts from the files.
 *
 * Why it exists at all: these five tracks total about 28 MB, they are the
 * largest thing a learner stores, and before this catalog nothing could see
 * them — they were not in any pack's `media` array, so the download flow did not
 * cache them, the offline bundle did not embed them, and the content reports
 * could not total them.
 */
export type ListenCatalogEntry = {
  lessonId: string;
  courseSlug: string;
  audioUrl: string;
  bytes: number;
  sha256: string;
};

export const listenCatalog = rawCatalog as {
  basis: string;
  entries: ListenCatalogEntry[];
};

export const listenCatalogEntries: readonly ListenCatalogEntry[] = listenCatalog.entries;

/** The tracks for one course, in catalog order. */
export function listenEntriesFor(courseSlug: string): ListenCatalogEntry[] {
  return listenCatalogEntries.filter((entry) => entry.courseSlug === courseSlug);
}

/** What this course's long-form audio costs a device, in bytes. */
export function listenBytesFor(courseSlug: string): number {
  return listenEntriesFor(courseSlug).reduce((total, entry) => total + entry.bytes, 0);
}

/** The shape `installPack` verifies against. */
export function listenAssetsFor(courseSlug: string): Array<{ url: string; sha256: string }> {
  return listenEntriesFor(courseSlug).map((entry) => ({
    url: entry.audioUrl,
    sha256: entry.sha256,
  }));
}

/**
 * `4941357` → `4.9 MB`. Rounded down, so the figure never overstates what a
 * learner is about to store.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "no audio yet";
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} kB`;
  return `${Math.floor((bytes / 1_000_000) * 10) / 10} MB`;
}
