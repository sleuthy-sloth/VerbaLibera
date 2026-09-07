// Bounded redacted logging for the desktop main process (Task 5).
// `desktop.log` rotates at 2 MiB with three retained files; every line is
// redacted and tagged with its lifecycle stage. Child environments are
// never logged.
import fs from "node:fs";
import path from "node:path";
import { redactLogLine } from "../security/redact";

export type LogStage =
  | "setup"
  | "database"
  | "migration"
  | "server"
  | "renderer"
  | "shutdown";

export interface LoggerOptions {
  maxBytes?: number;
  retain?: number;
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_RETAIN = 3;

export interface DesktopLogger {
  write: (stage: LogStage, line: string) => void;
}

export function createLogger(
  dir: string,
  options: LoggerOptions = {},
): DesktopLogger {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const retain = options.retain ?? DEFAULT_RETAIN;
  fs.mkdirSync(dir, { recursive: true });
  const current = path.join(dir, "desktop.log");

  function rotate(): void {
    let size = 0;
    try {
      size = fs.statSync(current).size;
    } catch {
      return;
    }
    if (size < maxBytes) return;
    fs.rmSync(`${current}.${retain}`, { force: true });
    for (let i = retain - 1; i >= 1; i -= 1) {
      const from = i === 1 ? current : `${current}.${i}`;
      if (fs.existsSync(from)) fs.renameSync(from, `${current}.${i + 1}`);
    }
  }

  return {
    write: (stage: LogStage, line: string) => {
      rotate();
      fs.appendFileSync(current, `[${stage}] ${redactLogLine(line)}\n`);
    },
  };
}
