import { createHash } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

import { initialCourses } from '../src/features/curriculum/fixture';

const CONTENT_VERSION_ID = 'fixtures';

const languages = [
  { code: 'en', displayName: 'English' },
  { code: 'fr', displayName: 'French' },
  { code: 'it', displayName: 'Italian' },
] as const;

function computeFixtureVersion(): string {
  return createHash('sha256').update(JSON.stringify(initialCourses)).digest('hex');
}

export async function seed(prisma: PrismaClient): Promise<void> {
  const fixtureVersion = computeFixtureVersion();

  await prisma.$transaction(async (transaction) => {
    const existingVersion = await transaction.contentVersion.findUnique({
      where: { id: CONTENT_VERSION_ID },
    });

    if (existingVersion && existingVersion.version !== fixtureVersion) {
      throw new Error(
        `Fixture drift detected: stored content version ${existingVersion.version} does not match current fixture version ${fixtureVersion}.`,
      );
    }

    await transaction.contentVersion.upsert({
      where: { id: CONTENT_VERSION_ID },
      update: { version: fixtureVersion },
      create: { id: CONTENT_VERSION_ID, version: fixtureVersion },
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
    console.info('Seeded original English-to-French and English-to-Italian A1 fixtures.');
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === new URL(process.argv[1] ?? '', 'file://').href) {
  main();
}
