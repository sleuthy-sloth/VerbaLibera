import { describe, expect, it } from "vitest";

import { createHostedEnvironment } from "@/features/course-pack/hosted-environment";

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
