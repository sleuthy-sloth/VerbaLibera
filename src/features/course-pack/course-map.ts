/**
 * The course map: one picture for the surface that shows a learner the path ahead.
 *
 * The app's progress surfaces are lists — the daily path, the course path, and the
 * weekly checklist on `/learn/<course>/plan`. The plan page is the one that literally
 * describes a route through the course (week by week, with a checklist per week), so
 * it is where a map belongs; the shells' paths already mark up-next, complete and
 * locked rows in words and tokens.
 *
 * **Its size is its own.** The lesson scenes are 800x600 because that is the frame
 * they are drawn in; this one is drawn 1264x848 (1.49:1) and is resized on width
 * alone to the same 800, so the six stops on the route stay inside the frame. Cropping
 * it to 4:3 would cut the flashcards and the notebook off the ends of the path.
 *
 * **Decorative.** The heading above it names the course and the plan, and the
 * checklist below it is the actual route; announcing the picture would say nothing
 * the page does not already say in words, which is why every surface renders it with
 * `alt=""`. It is not in the portable or downloaded edition either: those carry the
 * course path and the audio lessons, and this page is a hosted account surface
 * (`src/app/learn/[courseSlug]/plan/page.tsx` needs a session cookie), so there is
 * nothing to embed. The artwork itself has no lettering in it — checked file by file
 * with the rest of the set in `docs/image-provenance.md`.
 */

export const COURSE_MAP = {
  url: "/images/course-map.jpg",
  width: 800,
  height: 537,
  /** What it shows, in words — for provenance and tests, never rendered. */
  label: "A winding path linking six study stations: a book, headphones, flashcards, a stack of books, an audio player and a notebook",
} as const;
