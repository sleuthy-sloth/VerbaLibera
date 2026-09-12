// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FirstRunOnboarding } from "@/components/dashboard/FirstRunOnboarding";

/**
 * The blank learner's block.
 *
 * It used to lead with `logo-lockup.jpg` — the wide raster lockup with the name
 * drawn into it. On a 320px screen that rendered under 200px wide, so the name
 * inside it was unreadable and the mark read as a stray badge on an empty panel,
 * and a 260px square journal sat underneath it, outweighing the heading it was
 * introducing. The block now leads with the same raster mark the rest of the app
 * uses, at 44px, beside the name in live text, and the journal is a supporting
 * illustration.
 *
 * The structure is checked here; the sizes at 320px and 390px are measured in
 * `tests/e2e/onboarding.spec.ts`, where a real layout exists. The stylesheet rules
 * are read from the file, because what makes the journal *supporting* is a
 * declaration, not a rendered box that jsdom does not compute.
 */

const css = readFileSync(
  join(process.cwd(), "src/components/dashboard/dashboard.module.css"),
  "utf8",
);

const rule = (selector: string): string => {
  const match = css.match(new RegExp(`\\${selector} \\{([^}]*)\\}`));
  expect(match, `the ${selector} rule is missing`).not.toBeNull();
  return match![1];
};

describe("the first-run onboarding block", () => {
  it("names the app in live text beside the mark, not inside an image", () => {
    render(<FirstRunOnboarding />);
    expect(screen.getByText("VerbaLibera")).toBeInTheDocument();
    // The mark is decoration: the text beside it already says the name.
    const mark = document.querySelector("img[src*='logo-mark']") as HTMLImageElement;
    expect(mark, "the brand mark is not rendered").not.toBeNull();
    expect(mark.getAttribute("alt")).toBe("");
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("draws no raster logo lockup on this surface", () => {
    const { container } = render(<FirstRunOnboarding />);
    // The lockup's lettering is part of the image: it cannot scale with the
    // viewport and cannot be announced. Nothing here may reference it.
    expect(container.innerHTML).not.toContain("logo-lockup");
    expect(css).not.toContain("onboardingLockup");
  });

  it("sets the name in the display face, at a size that survives 320px", () => {
    const wordmark = rule(".onboardingWordmark");
    expect(wordmark, "the wordmark is not set in the display face").toContain(
      "var(--font-display)",
    );
    expect(wordmark, "the wordmark has no size of its own").toMatch(/font-size:\s*clamp\(/);
  });

  it("keeps the journal a fraction of the block rather than its subject", () => {
    const journal = rule(".onboardingJournal");
    const width = journal.match(/width:\s*min\((\d+)px,\s*(\d+)%\)/);
    expect(width, "the journal has no capped width").not.toBeNull();
    expect(Number(width![1]), "the journal is wider than a supporting illustration").toBeLessThanOrEqual(180);
    expect(Number(width![2]), "the journal takes more than half the block").toBeLessThanOrEqual(45);

    const { container } = render(<FirstRunOnboarding />);
    const image = container.querySelector("img[src*='empty-journal']") as HTMLImageElement;
    expect(image, "the journal illustration is not rendered").not.toBeNull();
    // Decorative, like the mark: the heading and paragraph carry the meaning.
    expect(image.getAttribute("alt")).toBe("");
    // Declared as the square it is, so it reserves its space before it loads.
    expect(image.getAttribute("width")).toBe("1024");
    expect(image.getAttribute("height")).toBe("1024");
  });

  it("does not set the body copy below 16px", () => {
    // 0.98rem rendered at 15.68px on the phone this block is read on.
    expect(rule(".onboardingCopy")).toMatch(/font-size:\s*1rem/);
  });

  it("still offers one clear way in", () => {
    render(<FirstRunOnboarding />);
    const action = screen.getByRole("link", { name: /start learning/i });
    expect(action).toHaveAttribute("href");
  });
});
