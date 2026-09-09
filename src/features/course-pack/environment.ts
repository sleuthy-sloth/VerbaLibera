import type { PracticeEvent } from "./progress";
import { mergeLearningEvents, lessonCheckpointSchema, type LearningEvent, type LessonCheckpoint } from "./attempts";
import type { RuntimePack } from "./lesson-runtime";
import type { CoursePack } from "./schema";

export type PracticeDurability = "durable" | "temporary";

export interface PracticeStore {
  getDurability(): PracticeDurability;
  subscribeDurability(
    listener: (value: PracticeDurability) => void,
  ): () => void;
  read(scope?: string | null): Promise<PracticeEvent[]>;
  write(events: PracticeEvent[], scope?: string | null): Promise<void>;
}

export interface CourseCapabilities {
  accounts: boolean;
  synchronization: boolean;
  offlineInstall: boolean;
  hostedNavigation: boolean;
}

export interface CourseEnvironment {
  capabilities: CourseCapabilities;
  practice: PracticeStore;
  /** V2 lesson events + checkpoints. Absent until the edition wires Task 4; LessonPlayer uses a test adapter meanwhile. */
  lessonPractice?: LessonPracticeStore;
  /** Bound to the same account/profile as lessonPractice. */
  backup?: { export(): Promise<unknown>; import(raw: string): Promise<void> };
  loadPack(language: string): Promise<CoursePack>;
  loadCourse?(language: string): Promise<CoursePack | RuntimePack>;
  resolveMedia(url: string): string;
  install?(pack: CoursePack, language: string): Promise<void>;
  isInstalled?(language: string): Promise<boolean>;
}

export interface LessonPracticeStore {
  readLessons(): Promise<LearningEvent[]>;
  writeLessons(events: LearningEvent[]): Promise<void>;
  readCheckpoint(packId: string, lessonId: string): Promise<LessonCheckpoint | null>;
  writeCheckpoint(checkpoint: LessonCheckpoint): Promise<void>;
}

export function createMemoryLessonPractice(
  initial: LearningEvent[] = [],
): LessonPracticeStore {
  let events = structuredClone(mergeLearningEvents(initial));
  const checkpoints = new Map<string, LessonCheckpoint>();
  return {
    async readLessons() {
      return structuredClone(events);
    },
    async writeLessons(incoming) {
      events = structuredClone(mergeLearningEvents(events, incoming));
    },
    async readCheckpoint(packId, lessonId) {
      return structuredClone(checkpoints.get(`${packId}/${lessonId}`) ?? null);
    },
    async writeCheckpoint(checkpoint) {
      const parsed = lessonCheckpointSchema.parse(checkpoint);
      checkpoints.set(`${parsed.packId}/${parsed.lessonId}`, structuredClone(parsed));
    },
  };
}
