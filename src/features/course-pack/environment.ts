import type { PracticeEvent } from "./progress";
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
  loadPack(language: string): Promise<CoursePack>;
  resolveMedia(url: string): string;
  install?(pack: CoursePack, language: string): Promise<void>;
  isInstalled?(language: string): Promise<boolean>;
}
