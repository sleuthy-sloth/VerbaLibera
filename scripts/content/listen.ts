import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

import { LISTEN_TRACKS } from "../../src/features/listen/tracks";

/**
 * The long-form Listen tracks, measured from the files that actually ship.
 *
 * These recordings are the biggest objects in the repository — roughly 5-6 MB
 * each, about 28 MB across the five languages — and until now nothing said so:
 * they were not in any pack's `media` array, so the download flow did not cache
 * them, the offline bundle did not embed them, and the content reports could not
 * total them. The catalog below is generated from disk so the size a learner is
 * told ("about 5 MB of audio") is the size that exists, not a number a doc
 * remembers.
 *
 * A missing or renamed file is a hard error: every advertised track must be
 * playable, and a track whose bytes changed must be re-measured before anything
 * quotes its size again.
 */
export type ListenCatalogEntry = {
  lessonId: string;
  courseSlug: string;
  audioUrl: string;
  bytes: number;
  sha256: string;
};

export type ListenCatalog = {
  basis: string;
  entries: ListenCatalogEntry[];
};

export const LISTEN_CATALOG_BASIS =
  "authored long-form audio lessons; bytes and digests measured from the shipped files";

export function buildListenCatalog(root = process.cwd()): ListenCatalog {
  const entries = LISTEN_TRACKS.map((track) => {
    const path = `${root}/public${track.audioUrl}`;
    const bytes = readFileSync(path);
    return {
      lessonId: track.lessonId,
      courseSlug: track.courseSlug,
      audioUrl: track.audioUrl,
      bytes: statSync(path).size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }).sort((a, b) => a.lessonId.localeCompare(b.lessonId));
  return { basis: LISTEN_CATALOG_BASIS, entries };
}

/** Total shipped audio for one course, for the size reported to a learner. */
export function listenBytesFor(catalog: ListenCatalog, courseSlug: string): number {
  return catalog.entries
    .filter((entry) => entry.courseSlug === courseSlug)
    .reduce((total, entry) => total + entry.bytes, 0);
}

export function listenTracksFor(catalog: ListenCatalog, courseSlug: string): number {
  return catalog.entries.filter((entry) => entry.courseSlug === courseSlug).length;
}

/**
 * Every way the committed catalog disagrees with the files on disk.
 *
 * Empty means the numbers a learner is shown still describe what ships: a track
 * that was re-recorded, truncated, renamed or added without re-measuring shows
 * up here rather than as a stale size on the Listen tab. Throws if a catalogued
 * track has no file at all.
 */
export function listenCatalogMismatches(
  catalog: ListenCatalog,
  root = process.cwd(),
): string[] {
  const measured = buildListenCatalog(root);
  const mismatches: string[] = [];
  const recorded = new Map(catalog.entries.map((entry) => [entry.audioUrl, entry]));
  for (const entry of measured.entries) {
    const known = recorded.get(entry.audioUrl);
    if (!known) {
      mismatches.push(`${entry.audioUrl}: ships but is not in the catalog`);
      continue;
    }
    if (known.bytes !== entry.bytes) {
      mismatches.push(`${entry.audioUrl}: catalog says ${known.bytes} bytes, file is ${entry.bytes}`);
    }
    if (known.sha256 !== entry.sha256) {
      mismatches.push(`${entry.audioUrl}: catalog digest does not match the file`);
    }
  }
  for (const entry of catalog.entries) {
    if (!measured.entries.some((candidate) => candidate.audioUrl === entry.audioUrl)) {
      mismatches.push(`${entry.audioUrl}: catalogued but not shipped`);
    }
  }
  return mismatches;
}
