"use client";

import { useEffect, useState } from "react";

import type { RendererApi, StorageStatus } from "../../../desktop/preload-api";

function api(): RendererApi | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { verbalibera?: RendererApi })
    .verbalibera;
  return candidate ?? null;
}

export default function DesktopSettings() {
  const [bridge] = useState<RendererApi | null>(() => api());
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [phrase, setPhrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    bridge
      .getStorageStatus()
      .then(setStatus)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
  }, [bridge]);

  if (!bridge) {
    return (
      <p>
        Storage settings are available in the VerbaLibera desktop app on
        this Mac.
      </p>
    );
  }

  async function schedule(mode: "local" | "remote"): Promise<void> {
    const bridge = api();
    if (!bridge) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await bridge.scheduleStorageChange(
        mode === "remote" ? { mode, databaseUrl: remoteUrl.trim() } : { mode },
      );
      const next = await bridge.getStorageStatus();
      setStatus(next);
      setMessage("Saved. Restart the app to apply the storage change.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function restart(): Promise<void> {
    await api()?.restart();
  }

  async function reset(): Promise<void> {
    const bridge = api();
    if (!bridge) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await bridge.resetLocalData(phrase);
      setMessage(
        `Local data moved to a backup. Restarting with a fresh database… (${result.backupPath})`,
      );
      await bridge.restart();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const leavingLocal =
    status?.active.mode === "local" && status?.pending?.mode === "remote";

  return (
    <div>
      <section>
        <h2>Storage</h2>
        {status ? (
          <p>
            Active: {status.active.mode}
            {status.pending
              ? ` · Pending (applies on restart): ${status.pending.mode}`
              : ""}
          </p>
        ) : (
          <p>Loading…</p>
        )}
        {leavingLocal ? (
          <p>
            Before restarting, use <strong>Export practice backup</strong> in
            the course workspace: switching away from local storage does not
            copy your progress.
          </p>
        ) : null}
        <div>
          <label htmlFor="desktop-remote-url">PostgreSQL connection string</label>
          <input
            id="desktop-remote-url"
            type="text"
            value={remoteUrl}
            autoComplete="off"
            spellCheck={false}
            placeholder="postgresql://USER@HOST:5432/DBNAME?sslmode=require (password + TLS required)"
            onChange={(event) => setRemoteUrl(event.target.value)}
          />
          <button
            type="button"
            disabled={busy || !remoteUrl.trim()}
            onClick={() => void schedule("remote")}
          >
            Switch to my server on restart
          </button>
        </div>
        <div>
          <button type="button" disabled={busy} onClick={() => void schedule("local")}>
            Switch to local storage on restart
          </button>
          {status?.restartRequired ? (
            <button type="button" disabled={busy} onClick={() => void restart()}>
              Restart now
            </button>
          ) : null}
        </div>
      </section>
      <section>
        <h2>Reset local data</h2>
        <p>
          Moves the entire local database to a dated backup folder. This
          cannot be undone from the app.
        </p>
        <label htmlFor="desktop-reset-phrase">
          Type RESET LOCAL DATA to confirm
        </label>
        <input
          id="desktop-reset-phrase"
          type="text"
          value={phrase}
          autoComplete="off"
          onChange={(event) => setPhrase(event.target.value)}
        />
        <button type="button" disabled={busy || !phrase} onClick={() => void reset()}>
          Reset local data
        </button>
      </section>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
