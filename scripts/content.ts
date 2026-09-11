import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { normalizePack } from "../src/features/course-pack/normalize-pack";
import { buildContentReport } from "./content/report";
const languages = readdirSync("courses", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const catalog: {
  slug: string;
  title: string;
  lessons: number;
  units: number;
  practiceActivities: number;
}[] = [];
const command = process.argv[2] ?? "validate";
for (const language of languages) {
  const path = `courses/${language}/manifest.json`,
    source = readFileSync(path, "utf8"),
    raw = JSON.parse(source),
    // Version dispatch: validates v1 or v2 and runs the full graph checks.
    pack = normalizePack(raw);
  for (const media of pack.media) {
    const bytes = readFileSync(`public${media.url}`);
    if (createHash("sha256").update(bytes).digest("hex") !== media.sha256)
      throw new Error(`Invalid audio hash: ${media.url}`);
  }
  // Retained v1 records keep the duplicate-answer census stable across versions.
  const exercises = pack.lessons.flatMap((l) => l.legacyExercises);
  const answerSets = new Map<string, string[]>();
  for (const e of exercises) {
    const key = e.answers.slice().sort().join("|");
    answerSets.set(key, [...(answerSets.get(key) ?? []), e.id]);
  }
  // Schema-aware: reachable runtime activities and retained v1 records are
  // counted separately, each with its own basis. See scripts/content/report.ts.
  const report = buildContentReport(raw, pack);
  // The catalog carries the pack facts the UI derives honest capability labels
  // from, so a screen never hardcodes which languages have structured courses.
  catalog.push({
    slug: language,
    title: pack.title,
    lessons: report.lessons,
    units: report.units,
    practiceActivities: report.runtimeActivities.practice,
  });
  console.log(
    JSON.stringify(
      command === "duplicates"
        ? {
            ...report,
            reusedAnswerSets: [...answerSets.values()].filter(
              (ids) => ids.length > 1,
            ),
          }
        : report,
      null,
      2,
    ),
  );
  if (command === "build") {
    mkdirSync("public/packs", { recursive: true });
    // Ship the authored source: editions load it through normalizePack.
    writeFileSync(`public/packs/${language}.json`, source);
    mkdirSync("docs/astra/reports", { recursive: true });
    writeFileSync(
      `docs/astra/reports/${language}.json`,
      JSON.stringify(report, null, 2) + "\n",
    );
  }
}
if (command === "build") {
  writeFileSync(
    "src/features/course-pack/catalog.json",
    JSON.stringify(catalog, null, 2) + "\n",
  );
  const { build } = await import("esbuild");
  // `write: false`: the bundle's own outputs are composed into the generated
  // artifacts explicitly. The previous version read the PREVIOUS
  // `public/study.css` back off disk, so the generated stylesheet depended on
  // generated output and prepended the source stylesheet again on every build
  // whenever the esbuild CSS output stopped landing at that exact path.
  const bundle = await build({
    entryPoints: ["src/features/course-pack/offline-entry.tsx"],
    bundle: true,
    minify: true,
    write: false,
    outfile: "study.js",
    platform: "browser",
    format: "iife",
    target: ["safari15"],
    define: { "process.env.NODE_ENV": '"production"' },
    legalComments: "eof",
  });
  const emitted = (extension: ".js" | ".css"): string =>
    bundle.outputFiles
      .filter((file) => file.path.endsWith(extension))
      .map((file) => file.text)
      .join("\n");
  const script = emitted(".js");
  if (script === "") throw new Error("offline bundle produced no JavaScript");
  const playerStyles = emitted(".css");
  if (playerStyles === "")
    throw new Error(
      "offline bundle produced no CSS: lesson-player styles would be missing from public/study.css",
    );
  writeFileSync("public/study.js", script);
  // Composed from canonical source only: the lesson stylesheet plus the
  // lesson-player styles the offline bundle just produced.
  writeFileSync(
    "public/study.css",
    readFileSync("src/features/course-pack/study.css", "utf8") + "\n" + playerStyles,
  );
  writeFileSync(
    "public/study.html",
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#fbf4e6"><title>VerbaLibera · Offline study</title><link rel="manifest" href="/manifest.webmanifest"><link rel="stylesheet" href="/study.css"></head><body><div id="study-root"><p>Opening your course. If it is not downloaded, connect once to install it.</p></div><script src="/study.js" defer></script></body></html>',
  );
}
