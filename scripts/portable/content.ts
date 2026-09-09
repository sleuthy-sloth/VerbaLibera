import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { extname, join } from "node:path";

import { normalizePack } from "../../src/features/course-pack/normalize-pack";
import type { RuntimePack } from "../../src/features/course-pack/lesson-runtime";
import type { CoursePack } from "../../src/features/course-pack/schema";

export type EmbeddedAsset = {
  mime: string;
  sha256: string;
  base64: string;
};

export type PortableContent = {
  packs: Record<string, RuntimePack | CoursePack>;
  assets: Record<string, EmbeddedAsset>;
};

const COURSE_BANNERS = [
  "/brand/courses/french.jpg",
  "/brand/courses/italian.jpg",
  "/brand/courses/portuguese.jpg",
  "/brand/courses/spanish.jpg",
] as const;

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
    !/^\/(?:audio|brand)\/[A-Za-z0-9._/-]+$/.test(value) ||
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

export function collectPortableContent(root: string): PortableContent {
  const coursesRoot = join(root, "courses");
  const languages = readdirSync(coursesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const packs: Record<string, RuntimePack> = {};
  const assets: Record<string, EmbeddedAsset> = {};
  const packIds = new Set<string>();
  const mediaIds = new Set<string>();

  for (const language of languages) {
    const pack = normalizePack(
      JSON.parse(
        readFileSync(join(coursesRoot, language, "manifest.json"), "utf8"),
      ),
    );
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

  return {
    packs: Object.fromEntries(Object.entries(packs).sort(([a], [b]) => a.localeCompare(b))),
    assets: Object.fromEntries(Object.entries(assets).sort(([a], [b]) => a.localeCompare(b))),
  };
}
