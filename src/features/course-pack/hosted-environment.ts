import type { CourseEnvironment } from "./environment";
import { validatePack } from "./schema";
import {
  installPack,
  installedPack,
  readEvents,
  storeEvents,
} from "./storage";

export function createHostedEnvironment(): CourseEnvironment {
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
