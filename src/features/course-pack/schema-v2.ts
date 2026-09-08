import { z } from "zod";
import { exerciseSchema } from "./schema";

/**
 * Strict authored v2 course-pack validation (plan Task 2). Authored JSON
 * uses arrays; `normalize-pack.ts` constructs runtime maps and runs the
 * graph/reference checks. v1 packs keep using `validatePack` in `schema.ts`.
 */

const text = z.string().trim().min(1).max(4000);
const id = z.string().regex(/^[a-z][a-z0-9-]{1,99}$/);
const positiveInt = z.number().int().positive();
const revision = z.number().int().positive().max(1000);

const errorCategories = z.enum([
  "wrong article",
  "wrong gender",
  "wrong number",
  "wrong conjugation",
  "wrong tense",
  "wrong auxiliary",
  "wrong preposition",
  "missing word",
  "extra word",
  "word-order problem",
  "accent/diacritic issue",
  "incorrect answer",
]);

const answerSpecSchema = z.object({
  answers: z.array(text).min(1).max(20),
  allowTypo: z.boolean().default(false),
  errors: z
    .array(
      z.object({
        answer: text,
        category: errorCategories,
        explanation: text,
      }),
    )
    .default([]),
});

const skillSchema = z.enum([
  "reading",
  "listening",
  "writing",
  "speaking",
  "grammar",
  "vocabulary",
]);

const assistanceSchema = z.enum(["hint", "translation", "transcript", "model"]);

const gradedBase = z.object({
  revision,
  conceptIds: z.array(id).min(1).max(5),
  vocabulary: z.array(id).max(8),
  skills: z.array(skillSchema).min(1).max(3),
  stimulusId: id.optional(),
  prompt: text,
  hints: z.array(text).max(5).default([]),
  feedback: text,
  evidenceKey: id,
  assistanceAffectsEvidence: z.array(assistanceSchema).default([]),
});

const optionSchema = z.object({ id, text: text.max(500) });

const activitySchema = z.discriminatedUnion("kind", [
  gradedBase.extend({
    kind: z.literal("legacy"),
    id,
    exerciseId: id,
  }),
  z.object({
    kind: z.literal("information"),
    id,
    revision,
    body: text,
    stimulusId: id.optional(),
  }),
  gradedBase.extend({
    kind: z.literal("text"),
    id,
    answer: answerSpecSchema,
  }),
  gradedBase.extend({
    kind: z.literal("selection"),
    id,
    options: z.array(optionSchema).min(2).max(6),
    acceptedIds: z.array(id).min(1).max(6),
    multiple: z.boolean(),
  }),
  gradedBase.extend({
    kind: z.literal("ordering"),
    id,
    tokens: z.array(optionSchema).min(2).max(12),
    acceptedOrders: z.array(z.array(id).min(2).max(12)).min(1).max(8),
  }),
  gradedBase.extend({
    kind: z.literal("matching"),
    id,
    left: z.array(optionSchema).min(2).max(8),
    right: z.array(optionSchema).min(2).max(8),
    acceptedPairs: z
      .array(z.object({ leftId: id, rightId: id }))
      .min(1)
      .max(8),
  }),
  gradedBase.extend({
    kind: z.literal("cloze"),
    id,
    segments: z
      .array(
        z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("text"), text: text.max(1000) }),
          z.object({
            kind: z.literal("blank"),
            name: z.string().regex(/^[a-z][a-z0-9-]{0,49}$/),
            label: text.max(200),
          }),
        ]),
      )
      .min(1)
      .max(20),
    blanks: z.record(z.string(), answerSpecSchema),
  }),
  gradedBase.extend({
    kind: z.literal("dialogue-choice"),
    id,
    options: z
      .array(optionSchema.extend({ feedback: text.max(1000) }))
      .min(2)
      .max(5),
    acceptedIds: z.array(id).min(1).max(5),
  }),
  gradedBase.extend({
    kind: z.literal("scene-selection"),
    id,
    stimulusId: id,
    acceptedRegionIds: z.array(id).min(1).max(12),
  }),
  z.object({
    kind: z.literal("self-compare"),
    id,
    revision,
    conceptIds: z.array(id).min(1).max(5),
    vocabulary: z.array(id).max(8),
    skills: z.array(skillSchema).min(1).max(3),
    stimulusId: id.optional(),
    prompt: text,
    modelText: text,
    modelAudioId: id.optional(),
  }),
]);

const stimulusSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    id,
    body: text,
    translation: text.optional(),
  }),
  z.object({
    kind: z.literal("examples"),
    id,
    pairs: z
      .array(z.object({ target: text.max(500), meaning: text.max(500) }))
      .min(1)
      .max(10),
  }),
  z.object({ kind: z.literal("audio"), id, mediaId: id }),
  z.object({
    kind: z.literal("dialogue"),
    id,
    turns: z
      .array(
        z.object({
          speaker: text.max(100),
          text: text.max(1000),
          meaning: text.max(1000).optional(),
          mediaId: id.optional(),
        }),
      )
      .min(2)
      .max(20),
  }),
  z.object({
    kind: z.literal("scene"),
    id,
    mediaId: id,
    alt: text.max(500),
    regions: z
      .array(
        z.object({
          id,
          label: text.max(200),
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          width: z.number().positive().max(1),
          height: z.number().positive().max(1),
        }),
      )
      .min(1)
      .max(12),
    textAlternative: text.max(1000),
  }),
]);

const localUrl = (prefix: string, extensions: string[]) =>
  z
    .string()
    .refine(
      (url) =>
        url.startsWith(`${prefix}/`) &&
        !url.split("/").includes("..") &&
        extensions.some((ext) => url.toLowerCase().endsWith(ext)),
      `Asset URL must be a local ${prefix} path (${extensions.join("/")}), no traversal`,
    );

const mediaSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("audio"),
    id,
    url: localUrl("/audio", [".mp3", ".wav", ".m4a", ".ogg"]),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    attribution: text.max(1000),
    transcript: text,
  }),
  z.object({
    kind: z.literal("image"),
    id,
    url: localUrl("/images", [".png", ".jpg", ".jpeg", ".svg", ".webp"]),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    attribution: text.max(1000),
  }),
]);

const stepSchema = z.object({
  id,
  purpose: z.enum([
    "notice",
    "predict",
    "explain",
    "practice",
    "transfer",
    "reflect",
  ]),
  activityId: id,
  required: z.boolean(),
  nextStepId: id.nullable(),
  branches: z.record(z.string(), id).default({}),
  supportActivityId: id.optional(),
});

const completionPolicySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("legacy-success"), exerciseIds: z.array(id) }),
  z.object({ kind: z.literal("participation") }),
  z.object({
    kind: z.literal("evidence"),
    targets: z
      .array(
        z.object({ evidenceKey: id, successes: positiveInt.max(10) }),
      )
      .min(1)
      .max(10),
  }),
]);

const prerequisiteSchema = z.object({
  lessonId: id,
  requirement: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("participation") }),
    z.object({
      kind: z.literal("evidence"),
      evidenceKey: id,
      successes: positiveInt.max(10),
    }),
    z.object({ kind: z.literal("legacy-success") }),
  ]),
});

const lessonSchemaV2 = z.object({
  id,
  unitId: id,
  title: text,
  objective: text,
  family: z.enum([
    "discovery",
    "story",
    "conversation",
    "listening",
    "construction",
    "scene",
    "mission",
    "recall",
  ]),
  revision,
  estimatedMinutes: positiveInt.max(60),
  entryStepId: id,
  steps: z.array(stepSchema).min(1).max(40),
  completionPolicy: completionPolicySchema,
  prerequisites: z.array(prerequisiteSchema).max(8).default([]),
  conceptIds: z.array(id).min(1).max(5),
  vocabulary: z.array(id).max(10),
  /** Legacy exercises retained for migration (full v1 exercise records, validated by the v1 schema); may be unused by the v2 sequence. */
  legacyExercises: z.array(exerciseSchema).default([]),
});

export const packSchemaV2 = z.object({
  schemaVersion: z.literal(2),
  id,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  language: z.enum(["it", "fr", "es", "pt", "de"]),
  status: z.enum(["active", "coming-soon"]).default("active"),
  title: text,
  sourceLanguage: z.literal("en"),
  description: text,
  attribution: text,
  units: z.array(z.object({ id, title: text, objective: text })),
  concepts: z.array(
    z.object({
      id,
      title: text,
      explanation: text,
      examples: z.array(z.object({ target: text, meaning: text })).min(1),
      commonError: text,
    }),
  ),
  vocabulary: z.array(
    z.object({
      id,
      word: text,
      meaning: text,
      partOfSpeech: text,
      gender: z.enum(["masculine", "feminine"]).optional(),
      example: text,
    }),
  ),
  media: z.array(mediaSchema),
  stimuli: z.array(stimulusSchema).default([]),
  activities: z.array(activitySchema),
  lessons: z.array(lessonSchemaV2),
  dialogues: z
    .array(
      z.object({
        id,
        title: text,
        prerequisite: id,
        goal: text,
        start: id,
        nodes: z
          .array(
            z.object({
              id,
              line: text,
              meaning: text,
              complete: z.boolean().default(false),
              choices: z
                .array(z.object({ text, next: id, feedback: text }))
                .max(5),
            }),
          )
          .min(2),
      }),
    )
    .default([]),
});

export type AuthoredV2Pack = z.infer<typeof packSchemaV2>;
export type AuthoredV2Activity = AuthoredV2Pack["activities"][number];
export type AuthoredV2Lesson = AuthoredV2Pack["lessons"][number];

export function validateV2Pack(raw: unknown): AuthoredV2Pack {
  return packSchemaV2.parse(raw);
}
