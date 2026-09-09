import type { CourseEnvironment } from "./environment";
import { normalizePack } from "./normalize-pack";
import { validatePack } from "./schema";
import {
  installPack,
  encodeBackup,
  importPracticeBackup,
  installedPack,
  readEvents,
  storeEvents,
  readLessonEvents,
  storeLessonEvents,
  readCheckpoint,
  writeCheckpoint,
} from "./storage";

export function createHostedEnvironment(scope: string | null = null): CourseEnvironment {
  return {
    capabilities: {
      accounts: true,
      synchronization: true,
      offlineInstall: true,
      hostedNavigation: true,
    },
    practice: {
      getDurability: () => "durable",
      subscribeDurability: () => () => {},
      read: readEvents,
      write: storeEvents,
    },
    // Bind once: an in-flight save from a previous account must never switch
    // destinations when the selected account changes.
    lessonPractice: {
      readLessons: () => readLessonEvents(scope),
      writeLessons: (events) => storeLessonEvents(events, scope),
      readCheckpoint: (packId, lessonId) => readCheckpoint(scope, packId, lessonId),
      writeCheckpoint: (checkpoint) => writeCheckpoint(checkpoint, scope),
    },
    backup: {
      async export() { return encodeBackup(await readEvents(scope), await readLessonEvents(scope)); },
      import: (raw) => importPracticeBackup(raw, scope),
    },
    async loadCourse(language) {
      const response = await fetch(`/packs/${language}.json`);
      if (!response.ok) throw new Error("This course is not downloaded. Connect once and download it for offline study.");
      const raw = await response.json();
      return raw.schemaVersion === 2 ? normalizePack(raw) : validatePack(raw);
    },
    async loadPack(language) {
      const response = await fetch(`/packs/${language}.json`);
      if (!response.ok) {
        throw new Error(
          "This course is not downloaded. Connect once and download it for offline study.",
        );
      }
      return validatePack(await response.json());
    },
    resolveMedia: (url) => url,
    install: installPack,
    isInstalled: installedPack,
  };
}
