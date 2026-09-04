'use client';

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
      // In a real flow, we would fetch registration options, call startRegistration, then POST to /api/auth/register
      // For now, show intent and call register with a mock payload that will be mocked in tests
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-registration-token': registrationToken },
        body: JSON.stringify({
          accountIdentifier: accountIdentifier.trim(),
          attestationResponse: { id: 'mock', rawId: 'mock', response: {}, clientExtensionResults: {}, type: 'public-key' },
          expectedChallenge: 'mock-challenge',
          registrationToken,
        }),
      });
      if (res.ok) {
        setStatus('Passkey registered. You can now sign in.');
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authenticationResponse: { id: 'mock', rawId: 'mock', response: { authenticatorData: '', clientDataJSON: '', signature: '' }, clientExtensionResults: {}, type: 'public-key' },
          expectedChallenge: 'mock-challenge',
        }),
      });
      if (res.ok) {
        setStatus('Signed in.');
        window.location.href = '/';
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
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Sign in to VerbaLibera</h1>
      <p style={{ color: '#555', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Passkeys keep your progress saved to your account. Nothing is shared.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
          <span>Account name</span>
          <input
            value={accountIdentifier}
            onChange={(e) => setAccountIdentifier(e.target.value)}
            placeholder="e.g. alex@example.com"
            aria-label="Account name"
            style={{
              minHeight: 44,
              padding: '0 12px',
              border: '1px solid #ccc',
              borderRadius: 8,
              fontSize: '1rem',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
          <span>Registration token (if required)</span>
          <input
            value={registrationToken}
            onChange={(e) => setRegistrationToken(e.target.value)}
            placeholder="Operator token"
            aria-label="Registration token"
            style={{
              minHeight: 44,
              padding: '0 12px',
              border: '1px solid #ccc',
              borderRadius: 8,
              fontSize: '1rem',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleRegister}
            disabled={isBusy}
            style={{
              minHeight: 44,
              minWidth: 140,
              padding: '0 16px',
              background: '#111',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Create passkey
          </button>
          <button
            onClick={handleLogin}
            disabled={isBusy}
            style={{
              minHeight: 44,
              minWidth: 140,
              padding: '0 16px',
              background: 'white',
              color: '#111',
              border: '1px solid #111',
              borderRadius: 8,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Sign in with passkey
          </button>
        </div>

        {status && (
          <p role="status" aria-live="polite" style={{ fontSize: '0.9rem', color: '#333', border: '1px solid #ddd', padding: '0.75rem', borderRadius: 8 }}>
            {status}
          </p>
        )}
      </div>
    </main>
  );
}
