// Recovery-window renderer script (Task 6).
// Reads the failure code/message from the location hash set by main.
import type { RendererApi } from "../preload-api";

declare global {
  interface Window {
    verbalibera: RendererApi;
  }
}

const params = new URLSearchParams(window.location.hash.slice(1));
const code = params.get("code") ?? "UNKNOWN";
const message = params.get("message") ?? "The app could not start.";

const summary = document.getElementById("summary");
if (summary) summary.textContent = `The app could not start (${code}).`;
const detail = document.getElementById("detail");
if (detail) detail.textContent = message;

document.getElementById("reveal-log")?.addEventListener("click", () => {
  void window.verbalibera.revealLog().catch(() => {});
});
document.getElementById("restart")?.addEventListener("click", () => {
  void window.verbalibera.restart().catch(() => {});
});
