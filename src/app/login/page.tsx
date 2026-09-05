'use client';

import Link from 'next/link';
import styles from './login.module.css';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { useState } from 'react';

export default function LoginPage() {
  const [accountIdentifier, setAccountIdentifier] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleRegister = async () => {
    if (!accountIdentifier.trim()) {
      setStatus('Enter an account name to register.');
      return;
    }
    setIsBusy(true);
    setStatus(null);
    try {
      const optionsResponse = await fetch(`/api/auth/register?account=${encodeURIComponent(accountIdentifier.trim())}`, {
        headers: { 'x-registration-token': registrationToken }, cache: 'no-store',
      });
      if (!optionsResponse.ok) {
        setStatus(optionsResponse.status === 409 ? 'That account name is already in use. Sign in with its passkey or choose another name.' : 'Could not start registration. Please try again.');
        return;
      }
      const attestationResponse = await startRegistration({ optionsJSON: await optionsResponse.json() });
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-registration-token': registrationToken },
        body: JSON.stringify({ accountIdentifier: accountIdentifier.trim(), attestationResponse, registrationToken }),
      });
      if (res.ok) {
        window.location.assign('/');
      } else if (res.status === 401) {
        setStatus('Registration not allowed. Check your registration token.');
      } else {
        setStatus('Registration failed. Try again.');
      }
    } catch {
      setStatus('Registration failed. Try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleLogin = async () => {
    setIsBusy(true);
    setStatus(null);
    try {
      const optionsResponse = await fetch('/api/auth/login', { cache: 'no-store' });
      if (!optionsResponse.ok) throw new Error('Could not start sign-in');
      const authenticationResponse = await startAuthentication({ optionsJSON: await optionsResponse.json() });
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authenticationResponse }),
      });
      if (res.ok) {
        setStatus('Signed in.');
        window.location.assign('/');
      } else {
        setStatus('Sign-in failed. Try again.');
      }
    } catch {
      setStatus('Sign-in failed. Try again.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main id="main-content" className={styles.page}>
      <Link className={styles.home} href="/">← VerbaLibera</Link>
      <div className={styles.layout}>
        <section className={styles.intro}>
          <p className={styles.kicker}>A little practice, kept.</p>
          <h1>Sign in to VerbaLibera</h1>
          <p>Keep the phrases you have practiced and return to the next useful lesson. Your learning stays yours.</p>
          <ul><li>Free lessons in four languages</li><li>Explanations before exercises</li><li>A review schedule that follows your practice</li></ul>
          <Link href="/learn/english-to-french">Explore a lesson first</Link>
        </section>
        <section className={styles.form} aria-label="Passkey account">
          <span className={styles.passkeyMark} aria-hidden="true">V</span>
          <h2>Your place to keep learning</h2>
          <p>Use a passkey with your device’s fingerprint, face recognition, or screen lock. No password to remember.</p>
          <label htmlFor="account-name">Account name</label>
          <input id="account-name" value={accountIdentifier} onChange={event => setAccountIdentifier(event.target.value)} placeholder="e.g. alex-learning" autoComplete="username webauthn" maxLength={100} />
          <p className={styles.hint}>Choose a unique name when creating an account. You can sign in with your passkey without typing it again.</p>
          <button onClick={handleRegister} disabled={isBusy} className={styles.primary} type="button">Create passkey</button>
          <button onClick={handleLogin} disabled={isBusy} type="button">Sign in with passkey</button>
          {isBusy ? <p role="status">Follow the passkey prompt on your device…</p> : null}
          {status ? <p role="status" className={styles.status}>{status}</p> : null}
          <details><summary>Have an invitation token?</summary><label htmlFor="registration-token">Registration token</label><input id="registration-token" value={registrationToken} onChange={event => setRegistrationToken(event.target.value)} autoComplete="off" /></details>
          <p className={styles.hint}>You can also learn without an account. Account progress is saved only when you choose a review action.</p>
        </section>
      </div>
    </main>
  );
}
