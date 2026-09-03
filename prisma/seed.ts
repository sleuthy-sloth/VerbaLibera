import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

import { initialCourses } from '../src/features/curriculum/fixture';

export const CONTENT_VERSION_ID = 'fixtures';

const languages = [
  { code: 'en', displayName: 'English' },
  { code: 'fr', displayName: 'French' },
  { code: 'it', displayName: 'Italian' },
  { code: 'es', displayName: 'Spanish' },
  { code: 'pt', displayName: 'Portuguese' },
] as const;

export function computeFixtureVersion(): string {
  return createHash('sha256').update(JSON.stringify(initialCourses)).digest('hex');
}

export function getBaseVersion(): string {
  const envVersion = process.env.CONTENT_VERSION?.trim();
  if (envVersion) return envVersion;
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkgRaw = readFileSync(pkgUrl, 'utf8');
    const pkg = JSON.parse(pkgRaw) as { version?: string };
    if (typeof pkg.version === 'string' && pkg.version.trim().length > 0) {
      return pkg.version.trim();
    }
  } catch {
    // ignore and fall through
  }
  return '0.0.0';
}

export function resolveContentVersion(): string {
  const base = getBaseVersion();
  const hash = computeFixtureVersion();
  // Use 12-char hash suffix for readable debug badge while still detecting drift
  // Format: <baseVersion>-<12 hex>  e.g. 0.1.0-afe82eda3788
  // Full hash is still implied; 12 chars gives 48-bit collision resistance,
  // enough to detect fixture change without bloating the badge.
  return `${base}-${hash.slice(0, 12)}`;
}

export async function seed(prisma: PrismaClient): Promise<void> {
  const fixtureHash = computeFixtureVersion();
  // Keep full hash for logging/diagnostics, but version string uses short hash for badge
  const contentVersion = resolveContentVersion();

  // All writes are upserts inside a transaction. Deletes are Restrict in schema
  // (ConceptBlock->Course, DrillItem->ConceptBlock, UserProgress->DrillItem, etc.)
  // so we never orphan UserProgress/ReviewLog and we preserve learner data.
  await prisma.$transaction(async (transaction) => {
    // Idempotent version bump: only changes when base version or fixture hash changes.
    // No throw on drift — we upsert and let version bump to reflect new fixtures.
    await transaction.contentVersion.upsert({
      where: { id: CONTENT_VERSION_ID },
      update: { version: contentVersion },
      create: { id: CONTENT_VERSION_ID, version: contentVersion },
    });

    for (const language of languages) {
      await transaction.language.upsert({
        where: { code: language.code },
        update: { displayName: language.displayName },
        create: language,
      });
    }

    for (const courseFixture of initialCourses) {
      const course = await transaction.course.upsert({
        where: { slug: courseFixture.slug },
        update: {
          sourceLanguageCode: courseFixture.sourceLanguageCode,
          targetLanguageCode: courseFixture.targetLanguageCode,
          title: courseFixture.title,
          description: courseFixture.description,
        },
        create: {
          slug: courseFixture.slug,
          sourceLanguageCode: courseFixture.sourceLanguageCode,
          targetLanguageCode: courseFixture.targetLanguageCode,
          title: courseFixture.title,
          description: courseFixture.description,
        },
      });

      for (const conceptFixture of courseFixture.concepts) {
        const concept = await transaction.conceptBlock.upsert({
          where: {
            courseId_position: {
              courseId: course.id,
              position: conceptFixture.position,
            },
          },
          update: {
            cefrLevel: conceptFixture.cefrLevel,
            title: conceptFixture.title,
            explanation: conceptFixture.explanation,
            assessmentCriteria: conceptFixture.assessmentCriteria,
            contentProvenance: conceptFixture.contentProvenance,
          },
          create: {
            id: conceptFixture.id,
            courseId: course.id,
            cefrLevel: conceptFixture.cefrLevel,
            position: conceptFixture.position,
            title: conceptFixture.title,
            explanation: conceptFixture.explanation,
            assessmentCriteria: conceptFixture.assessmentCriteria,
            contentProvenance: conceptFixture.contentProvenance,
          },
        });

        for (const drillFixture of conceptFixture.drills) {
          const drillData = {
            conceptBlockId: concept.id,
            cefrLevel: drillFixture.cefrLevel,
            kind: drillFixture.kind,
            prompt: drillFixture.prompt,
            acceptedResponses: [...drillFixture.acceptedResponses] as Prisma.InputJsonValue,
            recallTarget: drillFixture.recallTarget,
            contentProvenance: drillFixture.contentProvenance,
          };

          await transaction.drillItem.upsert({
            where: { id: drillFixture.id },
            update: drillData,
            create: { id: drillFixture.id, ...drillData },
          });
        }

        for (const segmentFixture of conceptFixture.audioSegments) {
          const durationMs =
            'durationMs' in segmentFixture && typeof segmentFixture.durationMs === 'number'
              ? segmentFixture.durationMs
              : null;
          const segmentData = {
            conceptBlockId: concept.id,
            drillItemId: null,
            type: segmentFixture.type,
            position: segmentFixture.position,
            pauseAfter: segmentFixture.pauseAfter,
            audioUrl: segmentFixture.audioUrl,
            transcript: segmentFixture.transcript,
            durationMs,
            contentProvenance: segmentFixture.contentProvenance,
          };

          await transaction.audioSegment.upsert({
            where: { id: segmentFixture.id },
            update: segmentData,
            create: { id: segmentFixture.id, ...segmentData },
          });
        }
      }
    }

    // Intentionally no deleteMany or cascading deletes here — UserProgress,
    // ConceptAssessment, ConceptMastery, ReviewLog, Credential are preserved
    // across seeds thanks to Restrict FKs and upsert-only logic.
    void fixtureHash;
  });
}

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed the curriculum.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await seed(prisma);
    console.info(
      `Seeded original English-to-French and English-to-Italian A1 fixtures (contentVersion=${resolveContentVersion()}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file://').href) {
  main();
}
