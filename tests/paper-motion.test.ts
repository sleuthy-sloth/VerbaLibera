import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Depth in this identity is a hard offset shadow, so movement has to read as
 * PAPER: a control lifts off the page when you reach for it and settles flat
 * when you press it. These tests hold that idea in place, because the failure
 * mode is not a broken animation, it is motion that quietly stops being
 * reducible, or a control that starts moving around under a pointer.
 */

const read = (p: string) => readFile(path.join(process.cwd(), p), "utf8");

const GLOBALS = "src/app/globals.css";
const STUDY = "src/features/course-pack/study.css";
const COURSES = "src/app/courses/courses.module.css";
// The paper cards of the Listen tab moved into the shared library stylesheet
// when the three editions (hosted, downloaded, portable) started rendering the
// same list; the page module keeps only chrome now.
const LISTEN = "src/components/listen/listen-library.module.css";

describe("paper motion", () => {
  it("defines the motion tokens an animation must use", async () => {
    const css = await read(GLOBALS);
    expect(css).toContain("--motion-fast:");
    expect(css).toContain("--motion-slow:");
    expect(css).toContain("--ease-paper:");
  });

  it("neutralises every animation and transition for reduced motion", async () => {
    const css = await read(GLOBALS);
    // Both the OS preference and the in-app toggle must zero out motion, or a
    // new animation ships that some learners cannot switch off.
    for (const block of [
      /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,400}transition-duration:\s*0\.01ms\s*!important/,
      /html\[data-motion='reduced'\][\s\S]{0,400}transition-duration:\s*0\.01ms\s*!important/,
    ])
      expect(css).toMatch(block);
  });

  it("lifts a control on hover and presses it flat when it is pressed", async () => {
    const css = await read(STUDY);
    // Hover raises the shadow, active collapses it: the two halves of paper.
    expect(css).toMatch(/\.study button:not\(:disabled\):hover\s*\{[^}]*box-shadow:\s*var\(--lift/);
    expect(css).toMatch(/\.study button:not\(:disabled\):active\s*\{[^}]*box-shadow:\s*0 0 0 transparent/);
    expect(css).toMatch(/\.study \.study-choice:active\s*\{[^}]*box-shadow:\s*0 0 0 transparent/);
  });

  it("takes every transition duration from a token, never a literal", async () => {
    const css = await read(STUDY);
    // The choice row shipped with hardcoded `.15s ease` before this. A first
    // version of this test only asked that SOME transition used the token, and
    // reverting one of them to `.15s ease` still passed. So: check every
    // declaration. Strip var() fallbacks first, because `var(--motion-fast,
    // 110ms)` legitimately names 110ms; what must not appear is a bare duration
    // written into the declaration itself.
    const transitions = [...css.matchAll(/transition:\s*([^;}]+)/g)].map((m) => m[1]);
    expect(transitions.length).toBeGreaterThan(0);
    for (const declaration of transitions) {
      const withoutFallbacks = declaration.replace(/var\([^)]*\)/g, "VAR");
      expect(withoutFallbacks, `literal duration in: ${declaration.trim()}`).not.toMatch(
        /\d+(?:\.\d+)?m?s\b/,
      );
    }
  });

  it("keeps the accent button's dark shadow through the hover lift", async () => {
    const css = await read(STUDY);
    // A generic soft-shadow hover rule ordered after .study-primary would
    // repaint the accent button's ink shadow and it would read as a plain
    // button. The dark-shadow rule must come last.
    const primary = css.indexOf(".study .study-primary:not(:disabled):hover");
    const generic = css.indexOf(".study button:not(:disabled):hover");
    expect(generic).toBeGreaterThan(-1);
    expect(primary).toBeGreaterThan(generic);
  });

  it("stamps the verdict in on the slow token", async () => {
    const css = await read(STUDY);
    expect(css).toContain("@keyframes feedbackStamp");
    expect(css).toMatch(/\.study-feedback\s*\{[^}]*animation:\s*feedbackStamp var\(--motion-slow/);
  });

  it("lifts the cards that are the shape of a sheet of paper", async () => {
    for (const file of [COURSES, LISTEN]) {
      const css = await read(file);
      expect(css, file).toMatch(/:hover,\s*\n?[^{]*:focus-within/);
      expect(css, file).toMatch(/box-shadow:\s*var\(--lift,/);
    }
  });

  it("gives keyboard users the same lift as pointer users", async () => {
    // hover alone is an affordance half the learners cannot reach.
    for (const file of [COURSES, LISTEN]) {
      const css = await read(file);
      expect(css, file).toContain(":focus-within");
    }
  });
});
