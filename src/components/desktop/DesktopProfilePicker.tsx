"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./desktop-panels.module.css";

export interface DesktopProfileSummary {
  id: string;
  displayName: string;
}

function csrfToken(): string {
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("verbalibera_csrf="));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
}

export default function DesktopProfilePicker({
  initialProfiles,
}: {
  initialProfiles: DesktopProfileSummary[];
}) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function select(profileId: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/desktop/bootstrap", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken(),
        },
        body: JSON.stringify({ profileId }),
      });
      const data = (await response.json()) as {
        status?: string;
        redirect?: string;
      };
      if (!response.ok || data.status !== "ok") {
        setError("That profile could not be opened. Please try again.");
        return;
      }
      router.replace(data.redirect ?? "/dashboard");
    } catch {
      setError("That profile could not be opened. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function create(): Promise<void> {
    const displayName = name.trim();
    if (!displayName) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/desktop/profiles", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken(),
        },
        body: JSON.stringify({ displayName }),
      });
      const data = (await response.json()) as {
        id?: string;
        displayName?: string;
      };
      if (!response.ok || !data.id) {
        setError("That profile could not be created. Please try again.");
        return;
      }
      setProfiles((current) => [
        ...current,
        { id: data.id as string, displayName: data.displayName ?? displayName },
      ]);
      setName("");
    } catch {
      setError("That profile could not be created. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      {profiles.length === 0 ? (
        <p className={styles.lede}>No local profiles yet. Create one to begin.</p>
      ) : (
        <ul className={styles.profileList}>
          {profiles.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={busy}
                onClick={() => void select(profile.id)}
              >
                Continue as {profile.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className={`${styles.card} ${styles.field}`}
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label htmlFor="desktop-profile-name">New profile name</label>
        <input
          id="desktop-profile-name"
          type="text"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
        />
        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={busy || !name.trim()}
          >
            Create profile
          </button>
        </div>
      </form>
      {error ? (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
