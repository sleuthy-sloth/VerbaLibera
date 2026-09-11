import { expect, it, vi } from "vitest";
import { listenAssetsFor } from "@/features/listen/catalog";

/**
 * The download flow has to take the long-form audio with it.
 *
 * The Listen tracks are not in any pack's `media` array (they are not lesson
 * performances), so `installPack` ignored them and a learner who saved a course
 * for offline use found the audio absent the moment they disconnected — the one
 * surface that is supposed to work without a network did not. These tests cover
 * the extras path: fetched, digest-verified, and cached with the pack.
 */

const FRENCH = listenAssetsFor("french");
const SHA = FRENCH[0]?.sha256 ?? "0".repeat(64);

function cacheApi() {
  const stores = new Map<string, Map<string, Response>>();
  return {
    stores,
    api: {
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
      open: async (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const entries = stores.get(name)!;
        return {
          put: async (key: string, value: Response) => {
            entries.set(key, value);
          },
          match: async (key: string) => entries.get(key),
        };
      },
    },
  };
}

async function withInstall(
  fetchImpl: (url: string) => Promise<Response>,
  run: () => Promise<void>,
) {
  const { stores, api } = cacheApi();
  vi.stubGlobal("caches", api);
  vi.stubGlobal("navigator", {
    serviceWorker: { register: async () => ({}), ready: Promise.resolve() },
    storage: { persist: async () => true },
  });
  vi.stubGlobal("fetch", fetchImpl);
  try {
    await run();
  } finally {
    vi.unstubAllGlobals();
  }
  return stores;
}

const pack = { id: "fr-foundations", version: "1.0.0", media: [] };

/** The pack JSON is validated on arrival; the audio is not JSON at all. */
function responseFor(url: string, body: string): Response {
  return new Response(url.endsWith(".json") ? JSON.stringify(pack) : body, { status: 200 });
}

it("caches the course's audio lessons alongside the pack", async () => {
  const requested: string[] = [];
  const stores = await withInstall(
    async (url) => {
      requested.push(url);
      return responseFor(url, "bytes");
    },
    async () => {
      const { installPack } = await import("@/features/course-pack/storage");
      // A stand-in for the real digest check: the install re-hashes whatever it
      // fetched, so the fetch response is what has to match.
      const digest = await sha256("bytes");
      const assets = FRENCH.map((asset) => ({ ...asset, sha256: digest }));
      await installPack(pack, "french", assets);
    },
  );
  for (const asset of FRENCH) expect(requested).toContain(asset.url);
  const installed = [...stores.values()].find((store) => store.has("/__course_pack_ready__"));
  expect(installed).toBeDefined();
  for (const asset of FRENCH) expect(installed!.has(asset.url)).toBe(true);
});

it("refuses to install audio whose bytes do not match the digest, and leaves nothing behind", async () => {
  const stores = await withInstall(
    async (url) => responseFor(url, "tampered"),
    async () => {
      const { installPack } = await import("@/features/course-pack/storage");
      await expect(
        installPack(pack, "french", [{ url: FRENCH[0].url, sha256: SHA }]),
      ).rejects.toThrow(/integrity check failed/i);
    },
  );
  // The failed download is discarded whole: no half-installed course, and no
  // ready marker for the service worker to read.
  expect([...stores.values()].some((store) => store.has("/__course_pack_ready__"))).toBe(false);
});

it("a download with no extras still installs (older courses, no audio)", async () => {
  const stores = await withInstall(
    async (url) => responseFor(url, "bytes"),
    async () => {
      const { installPack } = await import("@/features/course-pack/storage");
      await installPack(pack, "french");
    },
  );
  expect([...stores.values()].some((store) => store.has("/__course_pack_ready__"))).toBe(true);
});

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
