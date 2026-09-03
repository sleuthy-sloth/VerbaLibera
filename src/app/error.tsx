'use client';

import styles from '@/components/dashboard/dashboard.module.css';

type ErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function Error({ error, reset }: ErrorProps) {
  return (
    <main className={`${styles.dashboard} ${styles.focusSurface} ${styles.errorShell}`}>
      <div className={styles.errorMessage} role="alert">
        <p className={styles.eyebrow}>VoxLibre preview</p>
        <h1>Unable to load your practice path.</h1>
        <p>
          Something went wrong. Your preview progress is still safe. Try the read-only snapshot again.
        </p>
        {error?.digest ? (
          <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'color-mix(in srgb, var(--ink) 55%, transparent)' }}>
            Error reference: {error.digest}
          </p>
        ) : null}
      </div>
      <button onClick={() => reset()} type="button">
        Try again
      </button>
    </main>
  );
}
