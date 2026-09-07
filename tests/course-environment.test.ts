import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { CourseWorkspace } from "@/features/course-pack/CourseWorkspace";
import type { CourseEnvironment } from "@/features/course-pack/environment";
import { createHostedEnvironment } from "@/features/course-pack/hosted-environment";
import { validatePack } from "@/features/course-pack/schema";

const italian = validatePack(
  JSON.parse(readFileSync("courses/italian/manifest.json", "utf8")),
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
    loadPack: async () => italian,
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

    await screen.findByRole("heading", { name: "Italian foundations" });
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
