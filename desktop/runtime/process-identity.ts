// Guards against trusting a stale PID file: a recorded PID is only ours
// when it still resolves to the expected executable with the recorded
// start time. Prevents signalling or "reusing" an unrelated process that
// recycled the PID after an unclean shutdown.
import type { ProcessRecord, ProcessInspector } from "./contracts";

export async function ownsRecordedProcess(
  record: ProcessRecord,
  inspector: ProcessInspector,
): Promise<boolean> {
  const [command, startedAt] = await Promise.all([
    inspector.commandOf(record.pid),
    inspector.startTimeOf(record.pid),
  ]);
  if (command === null || startedAt === null) return false;
  const executable = command.split("/").pop() ?? command;
  return executable === record.executable && startedAt === record.startedAt;
}
