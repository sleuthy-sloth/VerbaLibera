import { expect, test, type Page } from "@playwright/test";

import { currentPrompt, loadPack, openLesson, primaryAction, answerStep } from "./helpers/lesson-walk";

/**
 * Layout regression coverage for the lesson surfaces, at the widths a learner
 * actually holds.
 *
 * Every assertion here is a defect that was measured on the running app during
 * the visual QA pass, not a shape that merely looks tidy:
 *
 *  - the v2 player's answer options picked up the legacy shell's `label` margin
 *    on top of their own grid gap, so two cards sat 28px apart where the design
 *    says 8;
 *  - the cloze blank inherited the legacy form-field rule and rendered as a
 *    full-width block box instead of an inline blank inside the sentence;
 *  - the progress row could not shrink, so every lesson step scrolled sideways
 *    on a 320px screen;
 *  - the legacy picture drill framed 16:9 vocabulary art in a 4:3 box, cropping
 *    about a quarter off each illustration.
 *
 * The widths are the phone sizes the product supports plus the desktop
 * breakpoint, where the floating tab capsule hands over to the header.
 */

const WIDTHS = [
  { width: 320, height: 568, label: "320" },
  { width: 390, height: 844, label: "390" },
  { width: 768, height: 1024, label: "768" },
  { width: 1440, height: 900, label: "1440" },
];

async function chooseLearner(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "verbalibera_onboarding:v1",
      JSON.stringify({ version: 1, courseSlug: "italian", status: "completed", entryIntent: "beginner" }),
    );
  });
}

/** Horizontal scroll, in pixels, of the document against the viewport. */
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

type ListGeometry = {
  declared: number;
  gaps: number[];
  box: number[];
};

const optionsGeometry = (page: Page) =>
  page.evaluate((): ListGeometry | null => {
    const list = document.querySelector(".lp-options, .lp-replies");
    if (!list) return null;
    const kids = [...list.children].filter((child) => {
      const r = child.getBoundingClientRect();
      return r.height > 1;
    });
    if (kids.length < 2) return null;
    const rects = kids.map((child) => child.getBoundingClientRect());
    const cs = getComputedStyle(list);
    return {
      declared: parseFloat(cs.rowGap || cs.gap) || 0,
      gaps: rects.slice(1).map((rect, index) => rect.top - rects[index].bottom),
      box: [Math.round(list.getBoundingClientRect().width), Math.round(list.getBoundingClientRect().height)],
    };
  });

for (const size of WIDTHS) {
  test(`the v2 lesson player holds its layout at ${size.label}px`, async ({ page }) => {
    test.setTimeout(240_000);
    page.setDefaultTimeout(8000);
    await chooseLearner(page);
    await page.setViewportSize({ width: size.width, height: size.height });
    const { activities } = loadPack("italian");
    await openLesson(page, "italian", "First words");

    let checkedOptions = 0;
    let checkedCloze = 0;

    for (let step = 0; step < 14; step += 1) {
      if ((await page.locator(".lp-complete").count()) > 0) break;
      const prompt = await currentPrompt(page);

      // 1. Nothing about the lesson may scroll the page sideways.
      expect(await overflow(page), `at ${size.label}px on "${prompt.slice(0, 40)}"`).toBeLessThanOrEqual(0);

      // 2. Answer cards sit on the grid's own gap. The legacy shell's `label`
      //    margin used to add 20px here (10px on each side of every card).
      const options = await optionsGeometry(page);
      if (options && options.gaps.length > 0) {
        const biggest = Math.max(...options.gaps);
        expect(
          biggest,
          `answer cards at ${size.label}px: ${options.gaps.map((g) => g.toFixed(1)).join("/")} against a declared ${options.declared}px gap`,
        ).toBeLessThanOrEqual(options.declared + 1);
        checkedOptions += 1;
      }

      // 3. The cloze blank stays inline inside its sentence, with the player's
      //    own underline rather than the shell's boxed field.
      if ((await page.locator(".lp-blank").count()) > 0) {
        const blank = await page.locator(".lp-blank").first().evaluate((node) => {
          const cs = getComputedStyle(node);
          const r = node.getBoundingClientRect();
          const sentence = node.closest(".lp-cloze")?.getBoundingClientRect();
          return {
            display: cs.display,
            width: Math.round(r.width),
            sentenceWidth: sentence ? Math.round(sentence.width) : 0,
            borderTop: cs.borderTopWidth,
            borderBottom: `${cs.borderBottomWidth} ${cs.borderBottomStyle}`,
          };
        });
        expect(blank.display, "the cloze blank should not be a block box").not.toBe("block");
        expect(blank.width, "the cloze blank should not fill the sentence").toBeLessThan(blank.sentenceWidth);
        expect(blank.borderTop, "the cloze blank should carry no box").toBe("0px");
        expect(blank.borderBottom, "the cloze blank should keep its underline").toContain("2px");
        checkedCloze += 1;
      }

      // 4. The lesson title keeps the player's own scale, not the shell's.
      const title = await page
        .locator(".lp-title")
        .first()
        .evaluate((node) => getComputedStyle(node).fontSize);
      expect(title, "the lesson title should render at the player's scale").toBe("25.6px");

      const action = await primaryAction(page);
      if (!action) {
        await answerStep(page, activities);
        const answered = await primaryAction(page);
        if (!answered) break;
        await answered.click();
        await page.waitForTimeout(140);
        if (answered.label === "Check") {
          const next = await primaryAction(page);
          if (next && next.label !== "Check") await next.click();
        }
        continue;
      }
      if (action.label === "Check") {
        await answerStep(page, activities);
        const check = await primaryAction(page);
        await check?.click();
        await page.waitForTimeout(140);
        const next = await primaryAction(page);
        if (next && next.label !== "Check") await next.click();
        await page.waitForTimeout(140);
        continue;
      }
      await action.click();
      await page.waitForTimeout(140);
    }

    expect(checkedOptions, "the walk should have measured the answer cards").toBeGreaterThan(0);
    expect(checkedCloze, "the walk should have measured the cloze blank").toBeGreaterThan(0);
  });
}

test("the picture drill frames vocabulary art in its own 16:9 frame", async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(8000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/learn/english-to-french", { waitUntil: "load" });

  for (let step = 0; step < 10; step += 1) {
    const grid = page.locator("[role='radiogroup'][aria-label='Picture choices']");
    if ((await grid.count()) > 0) {
      const pictures = await grid.locator("img").evaluateAll((nodes) =>
        nodes.map((node) => {
          const el = node as HTMLImageElement;
          const r = el.getBoundingClientRect();
          return {
            src: el.currentSrc.split("/").slice(-1)[0],
            natural: el.naturalWidth / el.naturalHeight,
            rendered: r.width / r.height,
          };
        }),
      );
      expect(pictures.length, "the drill should render its pictures").toBeGreaterThan(1);
      for (const picture of pictures) {
        expect(
          Math.abs(picture.natural - picture.rendered) / picture.natural,
          `${picture.src} is framed at ${picture.rendered.toFixed(3)} against its own ${picture.natural.toFixed(3)}`,
        ).toBeLessThan(0.06);
      }
      return;
    }
    const action = await primaryAction(page);
    if (action) {
      await action.click();
    } else {
      for (const name of ["Reveal model answer", "I checked my answer", "Continue without saving", "I got it"]) {
        const button = page.getByRole("button", { name, exact: true }).first();
        if ((await button.count()) > 0 && (await button.isVisible().catch(() => false))) {
          await button.click();
          break;
        }
      }
    }
    await page.waitForTimeout(220);
  }
  throw new Error("the walk never reached the picture drill");
});
