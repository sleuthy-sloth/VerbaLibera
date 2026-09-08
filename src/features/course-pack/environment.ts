import type { PracticeEvent } from "./progress";
import type { LearningEvent, LessonCheckpoint } from "./attempts";
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
  loadPack(language: string): Promise<CoursePack>;
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
  let events = [...initial];
  const checkpoints = new Map<string, LessonCheckpoint>();
  return {
    async readLessons() {
      return [...events];
    },
    async writeLessons(incoming) {
      events = [...events, ...incoming];
    },
    async readCheckpoint(packId, lessonId) {
      return checkpoints.get(`${packId}/${lessonId}`) ?? null;
    },
    async writeCheckpoint(checkpoint) {
      checkpoints.set(`${checkpoint.packId}/${checkpoint.lessonId}`, checkpoint);
    },
  };
}
