import { existsSync, readFileSync } from "node:fs";

/**
 * The human review record for a course, read from the course directory.
 *
 * `docs/human-review-gates.md` is where a person works out what is outstanding;
 * this is the per-course fact the generated reports quote, so a report cannot
 * claim a review that did not happen — or keep claiming "pending" for one that
 * did. A course with no `review.json` has had neither review, which is the
 * default and stays the default until someone records otherwise.
 *
 * `reportedBy` is deliberately a description and not a name: this file is
 * written from what the project owner reports, and inventing a reviewer is the
 * one thing a review record must never do.
 */
export type ReviewOutcome = Readonly<{
  status: "pending" | "reviewed";
  /** ISO date the review was reported, present only when reviewed. */
  date?: string;
  /** Who reported it, described rather than named. */
  reportedBy?: string;
  /** Exactly which text was read. */
  scope?: string;
}>;

export type ProseReview = Readonly<{
  nativeSpeaker: ReviewOutcome;
  audioListening: ReviewOutcome;
  note?: string;
}>;

const PENDING: ReviewOutcome = { status: "pending" };

export function readProseReview(language: string): ProseReview {
  const path = `courses/${language}/review.json`;
  if (!existsSync(path)) return { nativeSpeaker: PENDING, audioListening: PENDING };
  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<ProseReview>;
  return {
    nativeSpeaker: raw.nativeSpeaker ?? PENDING,
    audioListening: raw.audioListening ?? PENDING,
    ...(raw.note ? { note: raw.note } : {}),
  };
}

/**
 * The sentence a report carries about its reviews.
 *
 * It names what has actually happened for this course, so the two halves cannot
 * contradict each other: a reviewed course says who reported it and when, and an
 * unreviewed one says so plainly.
 */
export function reviewNote(review: ProseReview): string {
  const prose = review.nativeSpeaker.status === "reviewed"
    ? `Native-speaker review of the authored prose: reviewed (${review.nativeSpeaker.date ?? "date not recorded"}, reported by ${review.nativeSpeaker.reportedBy ?? "an unrecorded source"}).`
    : "Native-speaker review of the authored prose has not been performed.";
  const audio = review.audioListening.status === "reviewed"
    ? "Listening review of the audio: reviewed."
    : "Listening review of the audio has not been performed.";
  const extra = review.note ? ` ${review.note}` : "";
  return `${prose} ${audio} The audio integrity checks are mechanical, and the in-app player says the content is machine-authored.${extra}`;
}
