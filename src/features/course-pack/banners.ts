import type { CSSProperties } from "react";

import crops from "./banner-crops.json";

/**
 * Course banners: one map, one crop rule.
 *
 * The five banners are 2064x512 (4.03:1) and the drawing inside each frame is
 * narrower than the frame. German's is the extreme case — the street fills 56%
 * of the width, centred, with empty ground either side — so at the width of a
 * phone (`height: auto`) the whole 4:1 picture renders as an ~85px strip and the
 * drawing in it is too small to read. That is what "the German banner looks
 * wrong on mobile" was.
 *
 * The fix is a measured crop, not a chosen one: `scripts/brand/banner-crops.py`
 * measures each banner's artwork bounding box and writes the narrow-viewport
 * window — the art plus 6% breathing room, anchored on the art's own centre.
 * `tests/banner-crops.test.ts` re-derives the window from the same data and
 * fails if any artwork would fall outside it, so the crop can only ever remove
 * empty ground.
 *
 * The same map used to live inside `CourseWorkspace.tsx`, which is why the
 * course page showed a banner only in the legacy shell: a course that migrated
 * to v2 lost its artwork on its own page while the library still showed it.
 */

export const BANNER_BY_LANGUAGE: Record<string, string> = {
  french: "/brand/courses/french.jpg",
  italian: "/brand/courses/italian.jpg",
  spanish: "/brand/courses/spanish.jpg",
  portuguese: "/brand/courses/portuguese.jpg",
  german: "/brand/courses/german.jpg",
};

/** The frame the banners were drawn in; also the no-course fallback. */
export const BANNER_FULL_ASPECT = crops.fullAspect;

type BannerCrop = { cropAspect: number; focusX: number };

const cropFor = (language: string): BannerCrop | undefined =>
  (crops.courses as Record<string, BannerCrop | undefined>)[language];

/** The banner path for a course, or `undefined` when the course has no art. */
export const bannerFor = (language: string): string | undefined =>
  BANNER_BY_LANGUAGE[language];

/**
 * The narrow-viewport crop, as CSS custom properties.
 *
 * Returns `{}` for a course with no measured crop, which leaves the stylesheet's
 * defaults in place: the full 4.03:1 frame, centred. A new course therefore
 * renders correctly before anyone measures it — it just keeps the strip.
 */
export const bannerStyle = (language: string): CSSProperties => {
  const crop = cropFor(language);
  if (!crop) return {};
  return {
    "--banner-crop": String(crop.cropAspect),
    "--banner-focus": `${crop.focusX}%`,
  } as CSSProperties;
};
