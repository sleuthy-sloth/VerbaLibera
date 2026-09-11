import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { extname, join } from "node:path";

import { validatePack } from "../../src/features/course-pack/schema";
import type { CoursePack } from "../../src/features/course-pack/schema";
import { validateV2Pack } from "../../src/features/course-pack/schema-v2";
import type { AuthoredV2Pack } from "../../src/features/course-pack/schema-v2";
import catalog from "../../src/features/course-pack/catalog.json";
import { SCENE_URLS } from "../../src/features/course-pack/scenes";
import { PLAYER_ART_URLS } from "../../src/features/listen/player-art";
import { listenCatalogEntries } from "../../src/features/listen/catalog";
import type { ListenCatalogEntry } from "../../src/features/listen/catalog";

export type EmbeddedAsset = {
  mime: string;
  sha256: string;
  base64: string;
};

/** Authored (array-shaped) pack source, not normalized runtime output: the
 * portable environment re-validates/normalizes at load time and therefore
 * needs the original schema layout. */
export type PortablePack = CoursePack | AuthoredV2Pack;

export type PortableContent = {
  packs: Record<string, PortablePack>;
  assets: Record<string, EmbeddedAsset>;
  /**
   * The long-form Listen tracks embedded in this file, with the size of each.
   *
   * Empty unless the build asked for them (`--with-listen`): one track is about
   * 5-6 MB, so embedding all five would add roughly 37 MB of base64 to a file
   * that is already 17 MB — a decision for whoever builds the artifact, not a
   * default. The Listen view tells the learner which tracks this file carries
   * instead of rendering a player that cannot load.
   */
  listen: ListenCatalogEntry[];
};

/** Options a portable build can be asked for on the command line. */
export type PortableBuildOptions = {
  /** Course slugs whose long-form audio lessons to embed. */
  withListen?: readonly string[];
};

/**
 * The offline bundle embeds one banner per catalogued course. Derived from the
 * generated catalog rather than hand-listed: the previous hand-written list of
 * four silently omitted German, and because a missing file is skipped rather
 * than fatal, the German banner was simply absent from the portable edition.
 * A course without art now fails `tests/course-banners.test.ts` instead.
 */
const COURSE_BANNERS = catalog.map((entry) => `/brand/courses/${entry.slug}.jpg`);

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};

export function assertPortableAssetPath(value: string): void {
  if (
    !/^\/(?:audio|brand|images)\/[A-Za-z0-9._/-]+$/.test(value) ||
    value.includes("..") ||
    value.includes("\\")
  ) {
    throw new Error(`Unsafe portable asset path: ${value}`);
  }
}

function embedAsset(root: string, assetPath: string): EmbeddedAsset {
  assertPortableAssetPath(assetPath);
  const bytes = readFileSync(join(root, "public", assetPath.slice(1)));
  const extension = extname(assetPath).toLowerCase();
  const mime = MIME_BY_EXTENSION[extension];
  if (!mime) throw new Error(`Unsupported portable asset type: ${assetPath}`);
  return {
    mime,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    base64: bytes.toString("base64"),
  };
}

export function collectPortableContent(
  root: string,
  options: PortableBuildOptions = {},
): PortableContent {
  const coursesRoot = join(root, "courses");
  const languages = readdirSync(coursesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const packs: Record<string, PortablePack> = {};
  const assets: Record<string, EmbeddedAsset> = {};
  const packIds = new Set<string>();
  const mediaIds = new Set<string>();

  for (const language of languages) {
    const raw = JSON.parse(
      readFileSync(join(coursesRoot, language, "manifest.json"), "utf8"),
    ) as { schemaVersion?: unknown };
    // Validate the authored shape per version; keep arrays so the loader can
    // re-normalize later. Normalized runtime output is NOT portable input.
    const pack: PortablePack =
      raw.schemaVersion === 2 ? validateV2Pack(raw) : validatePack(raw);
    if (packIds.has(pack.id)) throw new Error(`Duplicate course ID: ${pack.id}`);
    packIds.add(pack.id);
    packs[language] = pack;

    for (const media of pack.media) {
      if (mediaIds.has(media.id)) {
        throw new Error(`Duplicate media ID: ${media.id}`);
      }
      mediaIds.add(media.id);
      const embedded = embedAsset(root, media.url);
      if (embedded.sha256 !== media.sha256) {
        throw new Error(`Media digest mismatch: ${media.url}`);
      }
      if (assets[media.url]) {
        throw new Error(`Duplicate media path: ${media.url}`);
      }
      assets[media.url] = embedded;
    }
  }

  for (const banner of COURSE_BANNERS) {
    if (existsSync(join(root, "public", banner.slice(1)))) {
      assets[banner] = embedAsset(root, banner);
    }
  }

  // The lesson-scene pictures. `RuntimeCourseWorkspace` resolves them through
  // `environment.resolveMedia`, which throws on a missing embedded asset, so a
  // scene the app can render must travel with the file — and derived from
  // `scenes.ts` rather than hand-listed, the way the banners are, so a new scene
  // cannot be added to the app and silently omitted from the portable edition.
  // A scene that is not on disk fails here rather than at first render.
  for (const sceneUrl of SCENE_URLS) {
    assets[sceneUrl] = embedAsset(root, sceneUrl);
  }

  // The player's artwork, for the same reason as the scenes: the Listen tab
  // renders in this file and `environment.resolveMedia` throws on an asset the
  // file does not carry. Derived from the module the components read.
  for (const playerArtUrl of PLAYER_ART_URLS) {
    assets[playerArtUrl] = embedAsset(root, playerArtUrl);
  }

  // Long-form audio, only for the courses the build asked for. Digests are
  // checked against the measured catalog, so a swapped or truncated mp3 cannot
  // ship silently inside a file the learner keeps forever.
  const listen: ListenCatalogEntry[] = [];
  for (const entry of listenCatalogEntries) {
    if (!options.withListen?.includes(entry.courseSlug)) continue;
    const embedded = embedAsset(root, entry.audioUrl);
    if (embedded.sha256 !== entry.sha256) {
      throw new Error(`Listen track digest mismatch: ${entry.audioUrl}`);
    }
    if (assets[entry.audioUrl]) {
      throw new Error(`Duplicate asset path: ${entry.audioUrl}`);
    }
    assets[entry.audioUrl] = embedded;
    listen.push(entry);
  }

  return {
    packs: Object.fromEntries(Object.entries(packs).sort(([a], [b]) => a.localeCompare(b))),
    assets: Object.fromEntries(Object.entries(assets).sort(([a], [b]) => a.localeCompare(b))),
    listen,
  };
}
