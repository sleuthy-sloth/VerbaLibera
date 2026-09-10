"use client";
import { useSyncExternalStore, useState } from 'react';
import { identifyAccount } from './sync';
const KEY = 'verbalibera-foundation-account';
const subscribe = (listener: () => void) => {
  window.addEventListener('foundation-account-selection', listener);
  return () => window.removeEventListener('foundation-account-selection', listener);
};
const snapshot = () => {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
};
const serverSnapshot = () => undefined;
export function usePracticeAccount() {
  const scope = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const select = (next: string | null) => {
    if (next) localStorage.setItem(KEY, next); else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event('foundation-account-selection'));
  };
  return { scope: scope ?? null, ready: scope !== undefined, select };
}
export function AccountPractice({ scope, select, status, retry }: {
  scope: string | null; select: (scope: string | null) => void; status: string; retry: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <section aria-label="Practice account" className="study-account">
    <p>{scope ? 'Keeping this on your account.' : 'Keeping this in this browser only.'}</p>
    <p className="study-scope">The two are separate. To move what is in this browser onto your account, export it here, switch to your account, then import it. Your account practice also stays available offline on this device.</p>
    <div className="study-actions">
      <button disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { select(await identifyAccount()); } catch (e) { setError(e instanceof Error ? e.message : 'Could not open account practice.'); }
        finally { setBusy(false); }
      }}>{busy ? 'Checking…' : 'Use my account'}</button>
      {scope ? <><button onClick={() => { try { select(null); } catch { setError('Could not switch back.'); } }}>Use this browser only</button><button onClick={retry}>Sync now</button></> : <a href="/login">Sign in</a>}
    </div>
    {status ? <p role="status">{status}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
