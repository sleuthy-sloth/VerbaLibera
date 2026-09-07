// Setup-window renderer script (Task 6).
// Runs sandboxed with only the five narrow preload methods available.
import type { RendererApi } from "../preload-api";

declare global {
  interface Window {
    verbalibera: RendererApi;
  }
}

function status(text: string, isError = false): void {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = text;
  el.className = isError ? "error" : "";
}

let approvalToken: string | null = null;

async function onChooseLocal(): Promise<void> {
  status("Setting up local storage…");
  try {
    await window.verbalibera.chooseLocal();
    status("Local storage ready. Starting VerbaLibera…");
  } catch (error) {
    status(error instanceof Error ? error.message : String(error), true);
  }
}

async function onInspectRemote(): Promise<void> {
  const input = document.getElementById("remote-url") as HTMLInputElement | null;
  const url = input?.value.trim() ?? "";
  if (!url) {
    status("Enter a PostgreSQL connection string first.", true);
    return;
  }
  status("Checking connection…");
  try {
    const result = await window.verbalibera.inspectRemote(url);
    approvalToken = result.approvalToken;
    const pending = document.getElementById("pending");
    if (pending) {
      pending.textContent =
        result.pending.length === 0
          ? "Connection works. No migrations needed."
          : `Connection works. Pending migrations: ${result.pending.join(", ")}`;
    }
    const approve = document.getElementById("approve-remote") as HTMLButtonElement | null;
    if (approve) approve.hidden = false;
    status("Connection verified.");
  } catch (error) {
    status(error instanceof Error ? error.message : String(error), true);
  }
}

async function onApproveRemote(): Promise<void> {
  if (!approvalToken) {
    status("Check the connection first.", true);
    return;
  }
  status("Migrating…");
  try {
    await window.verbalibera.approveRemoteMigration(approvalToken);
    approvalToken = null;
    status("Remote database ready. Starting VerbaLibera…");
  } catch (error) {
    status(error instanceof Error ? error.message : String(error), true);
  }
}

document.getElementById("choose-local")?.addEventListener("click", () => {
  void onChooseLocal();
});
document.getElementById("inspect-remote")?.addEventListener("click", () => {
  void onInspectRemote();
});
document.getElementById("approve-remote")?.addEventListener("click", () => {
  void onApproveRemote();
});
