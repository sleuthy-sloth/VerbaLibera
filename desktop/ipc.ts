// Restricted IPC handlers for setup/recovery windows (Task 6).
// Every invocation must originate from a packaged setup/recovery document
// (`event.senderFrame.url` allowlist) and every argument is Zod-validated.
// Unknown channels are never registered.
import { z } from "zod";
import { validateRemoteDatabaseUrl } from "./settings/schema";
import { desktopFailure } from "./runtime/errors";

export interface IpcSenderEvent {
  senderFrame?: { url?: string } | null;
}

export interface SetupFlows {
  chooseLocal: () => Promise<{ ok: true }>;
  inspectRemote: (
    url: string,
  ) => Promise<{ pending: string[]; approvalToken: string }>;
  approveRemoteMigration: (token: string) => Promise<{ ok: true }>;
  revealLog: () => Promise<void>;
  restart: () => Promise<void>;
}

export type IpcHandler = (
  event: IpcSenderEvent,
  ...args: unknown[]
) => Promise<unknown>;

function assertSender(allowed: string[], event: IpcSenderEvent): void {
  const url = event.senderFrame?.url;
  if (!url || !allowed.includes(url)) {
    throw new Error(`Rejected IPC invocation from sender: ${url ?? "none"}`);
  }
}

export function createIpcHandlers(deps: {
  allowedSenderUrls: string[];
  flows: SetupFlows;
}): Record<string, IpcHandler> {
  const { allowedSenderUrls, flows } = deps;
  return {
    "verbalibera:chooseLocal": async (event) => {
      assertSender(allowedSenderUrls, event);
      return flows.chooseLocal();
    },
    "verbalibera:inspectRemote": async (event, ...args) => {
      assertSender(allowedSenderUrls, event);
      const parsed = z.string().min(1).safeParse(args[0]);
      if (!parsed.success) {
        throw new Error("inspectRemote expects a connection-string argument.");
      }
      try {
        validateRemoteDatabaseUrl(parsed.data);
      } catch (error) {
        throw desktopFailure(
          "REMOTE_TLS_REQUIRED",
          error instanceof Error ? error.message : String(error),
        );
      }
      return flows.inspectRemote(parsed.data);
    },
    "verbalibera:approveRemoteMigration": async (event, ...args) => {
      assertSender(allowedSenderUrls, event);
      const parsed = z.string().min(1).safeParse(args[0]);
      if (!parsed.success) {
        throw new Error("approveRemoteMigration expects a token argument.");
      }
      return flows.approveRemoteMigration(parsed.data);
    },
    "verbalibera:revealLog": async (event) => {
      assertSender(allowedSenderUrls, event);
      return flows.revealLog();
    },
    "verbalibera:restart": async (event) => {
      assertSender(allowedSenderUrls, event);
      return flows.restart();
    },
  };
}
