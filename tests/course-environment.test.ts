import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { CourseWorkspace } from "@/features/course-pack/CourseWorkspace";
import type { CourseEnvironment } from "@/features/course-pack/environment";
import { createHostedEnvironment } from "@/features/course-pack/hosted-environment";
import { validatePack } from "@/features/course-pack/schema";

const german = validatePack(
  JSON.parse(readFileSync("courses/german/manifest.json", "utf8")),
);

function portableFixtureEnvironment(
  durability: "durable" | "temporary" = "durable",
): CourseEnvironment {
  return {
    capabilities: {
      accounts: false,
      synchronization: false,
      offlineInstall: false,
      hostedNavigation: false,
    },
    practice: {
      getDurability: () => durability,
      subscribeDurability: () => () => {},
      read: async () => [],
      write: async () => {},
    },
    loadPack: async () => german,
    resolveMedia: (url) => `blob:portable${url}`,
  };
}

describe("hosted course environment", () => {
  it("exposes the complete hosted capability set", () => {
    expect(createHostedEnvironment().capabilities).toEqual({
      accounts: true,
      synchronization: true,
      offlineInstall: true,
      hostedNavigation: true,
    });
  });
});

describe("portable course environment", () => {
  it("omits account, install, and hosted navigation controls", async () => {
    render(
      createElement(CourseWorkspace, {
        environment: portableFixtureEnvironment(),
      }),
    );

    await screen.findByRole("heading", { name: "German foundations" });
    expect(screen.queryByRole("region", { name: "Practice account" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Download/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Daily path/i })).toBeNull();
  });

  it("resolves lesson media through the environment", async () => {
    const user = userEvent.setup();
    render(
      createElement(CourseWorkspace, {
        environment: portableFixtureEnvironment(),
      }),
    );

    await user.click(await screen.findByRole("button", { name: "Open next lesson" }));
    expect(screen.getByLabelText("Model audio")).toHaveAttribute(
      "src",
      expect.stringMatching(/^blob:portable/),
    );
  });

  it("shows a sequenced path with an explicit next lesson and review route", async () => {
    render(
      createElement(CourseWorkspace, {
        environment: portableFixtureEnvironment(),
      }),
    );

    expect(await screen.findByRole("navigation", { name: "Course path" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Course progress" })).toHaveValue(0);
    expect(screen.getByText(/Up next — select to start/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First words" })).toBeInTheDocument();
    // Locked rows no longer carry an `opacity: .72` (that composited the muted
    // ink down to 3.27:1 and was the bulk of the contrast failures) and the
    // sentence is now short: the dependency reads "After <prerequisite>", with
    // a lock glyph that is hidden from assistive tech.
    expect(screen.getByText(/After First words/)).toBeInTheDocument();
  });

  it("warns persistently when practice storage is temporary", async () => {
    render(
      createElement(CourseWorkspace, {
        environment: portableFixtureEnvironment("temporary"),
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Progress is temporary in this browser. Export a backup before closing this file.",
    );
  });
});
