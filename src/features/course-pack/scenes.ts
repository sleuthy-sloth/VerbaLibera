/**
 * Lesson scenes: the situation picture, keyed by the situation.
 *
 * The app teaches situations — "Ordering coffee or food", "Paying", "Checking in
 * at a hotel" — and its lessons and travel patterns already carry that label as
 * authored data (`scenario` in `src/features/curriculum/fixture.ts`, and lesson ids
 * like `de-cafe-requests-foundation` in the packs). This module maps those to the
 * approved scene illustrations so a lesson can show the situation it is about.
 *
 * **Keyed by situation, not by lesson.** The same picture serves every language's
 * café lesson, and the scenario strings are shared verbatim across French,
 * Italian, Spanish and Portuguese, so one table covers all of them. A lesson whose
 * situation has no scene simply renders none — `sceneForLessonId` returns
 * `undefined` rather than guessing at a near-miss keyword.
 *
 * **Why not the pack model's own scene stimulus.** `schema-v2.ts` can already
 * carry `{ kind: "scene", mediaId, alt, regions }` with a `scene-selection`
 * activity that asks a learner to pick regions of the picture. Nothing in the tree
 * authors one, and doing so means writing region labels and a quiz per lesson —
 * content work, not wiring. This is the smaller step: orientation art on the
 * lesson the situation belongs to, with the picture and its regions left for
 * whoever authors that activity.
 *
 * **The pictures are decorative on the lesson surface**, so every surface renders
 * them with `alt=""`: the lesson title, its objective and the session's `Scenario`
 * line already say in words what the picture shows, and announcing the same thing
 * twice is noise. Where a picture *is* the question — the vocabulary drills — the
 * alt text is the accessible name (see the fixture).
 *
 * Two of the ten approved files carry artwork text, recorded in
 * `docs/image-provenance.md` rather than reproduced here: the hotel scene has a
 * reception sign printed in Spanish, and no other scene file has any lettering.
 * That text is never rendered as copy, never used as a label, and is deliberately
 * absent from this module and from every file under `src/` —
 * `tests/scenes.test.ts` greps for it.
 */

const SCENE_DIR = "/images/scenes";

/** Every scene file is 800x600 — the supplied art's own 4:3 frame. */
export const SCENE_SOURCE = { width: 800, height: 600 } as const;

export type SituationId =
  | "ordering-coffee"
  | "asking-for-the-bill"
  | "hotel-checkin"
  | "directions"
  | "station-counter";

export type Scene = Readonly<{
  situation: SituationId;
  /** What the picture shows, in words — for provenance and tests, never rendered. */
  label: string;
  url: string;
  width: number;
  height: number;
}>;

const SCENE_BY_SITUATION: Record<SituationId, Omit<Scene, "situation" | "url" | "width" | "height"> & { file: string }> = {
  "ordering-coffee": {
    file: "ordering-coffee.jpg",
    label: "A customer at a café counter with an espresso machine and a cup of coffee",
  },
  "asking-for-the-bill": {
    file: "asking-for-the-bill.jpg",
    label: "A guest at a restaurant table raising a hand to ask for the bill",
  },
  "hotel-checkin": {
    file: "hotel-checkin.jpg",
    label: "A guest with a suitcase at a hotel reception desk, receptionist behind the counter",
  },
  directions: {
    file: "directions.jpg",
    label: "Two people pointing at a large street map on a wall",
  },
  "station-counter": {
    file: "station-counter.jpg",
    label: "A clerk and a customer exchanging a ticket across a counter window",
  },
};

/**
 * The authored situation labels the travel patterns share.
 *
 * `fixture.ts` gives every pattern a `scenario`; the wording is identical in all
 * four travel languages (`fr-`, `it-`, `es-`, `pt-`), which is why this table is
 * not per language. `tests/scenes.test.ts` fails if any of these strings stops
 * existing in the fixture, so a reworded scenario is caught here rather than
 * silently dropping a picture.
 */
const SITUATION_BY_SCENARIO: Record<string, SituationId> = {
  "Ordering coffee or food": "ordering-coffee",
  Paying: "asking-for-the-bill",
  "Checking in at a hotel": "hotel-checkin",
  "Asking for directions": "directions",
  "Finding a place": "directions",
};

/**
 * Lesson-id segments: the part between the language prefix and `-foundation`.
 *
 * Only exact semantic matches are listed. `de-cafe-requests-foundation` is the
 * café counter; `de-directions-foundation` is the map; the `transport` lessons are
 * the counter where you buy a ticket. A topic like `food-foundation` is not a
 * café counter and is deliberately absent.
 */
const SITUATION_BY_LESSON_KEY: Record<string, SituationId> = {
  "cafe-requests": "ordering-coffee",
  directions: "directions",
  transport: "station-counter",
};

const sceneFor = (situation: SituationId): Scene => {
  const entry = SCENE_BY_SITUATION[situation];
  return {
    situation,
    label: entry.label,
    url: `${SCENE_DIR}/${entry.file}`,
    width: SCENE_SOURCE.width,
    height: SCENE_SOURCE.height,
  };
};

/** Every situation's scene, in declaration order. */
export const SCENES: readonly Scene[] = (Object.keys(SCENE_BY_SITUATION) as SituationId[]).map(sceneFor);

export const sceneForSituation = (situation: string): Scene | undefined =>
  situation in SCENE_BY_SITUATION ? sceneFor(situation as SituationId) : undefined;

/** The scene for an authored pattern scenario, or `undefined` when there is none. */
export const sceneForScenario = (scenario: string): Scene | undefined => {
  const situation = SITUATION_BY_SCENARIO[scenario];
  return situation ? sceneFor(situation) : undefined;
};

/** The scene for a lesson id, or `undefined` when the lesson is not one of the five situations. */
export const sceneForLessonId = (lessonId: string): Scene | undefined => {
  const key = lessonId.replace(/^[a-z]{2}-/, "").replace(/-foundation$/, "");
  const situation = SITUATION_BY_LESSON_KEY[key];
  return situation ? sceneFor(situation) : undefined;
};

/** Every scene URL, for the editions that have to embed them. */
export const SCENE_URLS: readonly string[] = SCENES.map((scene) => scene.url);
