import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { observe, withObserve } from '@/lib/observe';

describe('observability without surveillance (Task 18)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('observe logs only route/status/duration via console.error, never transcript/audio/credential/body', () => {
    observe({ route: '/api/voice/transcribe', status: 200, durationMs: 42 });

    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join(' ');
    // must log route/status/duration
    expect(logged).toContain('/api/voice/transcribe');
    expect(logged).toContain('200');
    expect(logged.toLowerCase()).toContain('duration');
    expect(logged.toLowerCase()).toContain('route');
    expect(logged.toLowerCase()).toContain('status');

    errorSpy.mockClear();

    // even if caller tries to sneak transcript/audio/credential/body, they must not appear
    observe({
      route: '/api/voice/transcribe',
      status: 200,
      durationMs: 10,
      transcript: 'secret transcript should never appear',
      audio: 'secret-audio-blob',
      credential: 'secret-credential',
      body: 'secret-body',
    } as unknown as Parameters<typeof observe>[0]);

    const logged2 = errorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join(' ');
    expect(logged2).not.toContain('secret transcript should never appear');
    expect(logged2).not.toContain('secret-audio-blob');
    expect(logged2).not.toContain('secret-credential');
    expect(logged2).not.toContain('secret-body');
    // also ensure forbidden keys themselves are not serialized when passed
    expect(logged2.toLowerCase()).not.toContain('transcript');
    expect(logged2.toLowerCase()).not.toContain('credential');
    // audio appears only if we consider the string 'audio' as a key; implementation must strip it
    // We allow the word 'audio' in route only — here route is transcribe, not audio
    const hasAudioKey = /"audio"\s*:/.test(logged2.toLowerCase());
    expect(hasAudioKey, 'observe must not serialize audio field').toBe(false);
  });

  it('observe does not log PII when error contains sensitive text', () => {
    // error message may contain sensitive text in real throw; observe should still not leak transcript
    // Our observe only logs sanitized error message — but must not inject transcript from elsewhere
    observe({
      route: '/api/demo/progress',
      status: 500,
      durationMs: 5,
      error: new Error('something failed'),
    });
    const logged = errorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join(' ');
    expect(logged.toLowerCase()).toContain('route');
    expect(logged).toContain('500');
    expect(logged.toLowerCase()).not.toContain('transcript');
    expect(logged.toLowerCase()).not.toContain('audio');
    expect(logged.toLowerCase()).not.toContain('credential');
  });

  it('withObserve logs route+status+duration not body, without leaking transcript', async () => {
    const handler = vi.fn(async (_req: Request) => {
      // handler returns a transcript in the body — wrapper must not log that body
      return new Response(JSON.stringify({ status: 'ok', transcript: 'secret transcript from handler' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const wrapped = withObserve('/api/voice/transcribe', handler);
    const req = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: 'blob', shouldNotBeLogged: 'body content' }),
    });

    const res = await wrapped(req);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);

    expect(errorSpy).toHaveBeenCalled();
    const logged = errorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join(' ');

    // must contain route and status, and duration
    expect(logged).toContain('/api/voice/transcribe');
    expect(logged).toContain('200');
    expect(logged.toLowerCase()).toContain('duration');
    expect(logged.toLowerCase()).toContain('route');
    expect(logged.toLowerCase()).toContain('status');

    // must NOT contain body/transcript/audio/credential
    expect(logged).not.toContain('secret transcript from handler');
    expect(logged).not.toContain('shouldNotBeLogged');
    expect(logged).not.toContain('blob');
    expect(logged.toLowerCase()).not.toContain('transcript');
  });

  it('withObserve logs 500 on thrown error without leaking body', async () => {
    const handler = vi.fn(async (_req: Request): Promise<Response> => {
      throw new Error('handler boom');
    });

    const wrapped = withObserve('/api/answer-check', handler);
    const req = new Request('http://localhost/api/answer-check', {
      method: 'POST',
      body: JSON.stringify({ response: 'secret response' }),
    });

    const res = await wrapped(req);
    expect(res.status).toBe(500);

    const logged = errorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join(' ');
    expect(logged).toContain('/api/answer-check');
    expect(logged).toContain('500');
    expect(logged.toLowerCase()).toContain('route');
    expect(logged.toLowerCase()).toContain('status');
    expect(logged.toLowerCase()).toContain('duration');
    // body must not be in log even on error
    expect(logged).not.toContain('secret response');
    // wrapper should log sanitized error and still not leak audio/transcript/credential
    expect(logged.toLowerCase()).not.toContain('audio');
    expect(logged.toLowerCase()).not.toContain('credential');
  });

  it('withObserve returns a wrapped handler that preserves successful response body', async () => {
    const handler = vi.fn(async (_req: Request) => new Response(JSON.stringify({ status: 'ok' }), { status: 201 }));
    const wrapped = withObserve('/api/demo/progress', handler);
    const req = new Request('http://localhost/api/demo/progress');
    const res = await wrapped(req);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ status: 'ok' });
  });

  it('observe uses console.error and supports optional SENTRY_DSN without leaking PII', async () => {
    const fetchSpy = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);
    vi.stubEnv('SENTRY_DSN', 'https://example.com/sentry');

    observe({ route: '/api/demo/progress', status: 200, durationMs: 7 });

    // console.error must be used
    expect(errorSpy).toHaveBeenCalled();
    const logged = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(logged).toContain('/api/demo/progress');

    // SENTRY_DSN fetch, if triggered, must also not contain transcript
    if (fetchSpy.mock.calls.length > 0) {
      const maybeArgs = fetchSpy.mock.calls[0] as unknown as [string, Record<string, unknown>];
      const sentBody = String((maybeArgs[1] as { body?: unknown })?.body ?? maybeArgs[1] ?? '');
      expect(sentBody.toLowerCase()).not.toContain('transcript');
      expect(sentBody.toLowerCase()).not.toContain('audio');
      expect(sentBody.toLowerCase()).not.toContain('credential');
    }

    vi.stubEnv('SENTRY_DSN', '');
    fetchSpy.mockClear();
    errorSpy.mockClear();

    // without SENTRY_DSN, fetch should not be called
    observe({ route: '/api/health', status: 200, durationMs: 3 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("docs/privacy.md exists and documents what is/isn't logged: only route/status/duration, never audio/transcript/credential", () => {
    const p = path.join(process.cwd(), 'docs/privacy.md');
    expect(fs.existsSync(p), 'expected docs/privacy.md to exist').toBe(true);
    const content = fs.readFileSync(p, 'utf8');
    const lower = content.toLowerCase();

    // must document what IS logged
    expect(lower).toContain('route');
    expect(lower).toContain('status');
    expect(lower).toContain('duration');

    // what is logged section should only list route/status/duration (plus durationMs synonym)
    // Extract the "what is logged" section if possible
    const loggedSectionMatch = content.split(/what is not logged|what isn't logged|never logged|is not logged|isn't logged/i)[0];
    const loggedSection = loggedSectionMatch ? loggedSectionMatch.toLowerCase() : lower;
    // In the logged section, forbidden fields must not appear as logged fields
    // We check that the logged section does not claim to log audio/transcript/credential
    expect(loggedSection).not.toMatch(/audio/);
    expect(loggedSection).not.toMatch(/transcript/);
    expect(loggedSection).not.toMatch(/credential/);

    // The doc as a whole must make clear that audio/transcript/credential are NEVER logged
    // So it must mention them in a negative context
    expect(lower).toContain('audio');
    expect(lower).toContain('transcript');
    expect(lower).toContain('credential');
    // and must say they are never / not / no / without
    expect(lower).toMatch(/never.*audio|not.*audio|no.*audio|without.*audio/i);
    expect(lower).toMatch(/never.*transcript|not.*transcript|no.*transcript|without.*transcript/i);
    expect(lower).toMatch(/never.*credential|not.*credential|no.*credential|without.*credential/i);
  });

  it('all api route handlers are wrapped with withObserve', () => {
    const routes = [
      'src/app/api/voice/transcribe/route.ts',
      'src/app/api/voice/health/route.ts',
      'src/app/api/answer-check/route.ts',
      'src/app/api/auth/login/route.ts',
      'src/app/api/auth/register/route.ts',
      'src/app/api/auth/logout/route.ts',
      'src/app/api/progress/review/route.ts',
      'src/app/api/demo/progress/route.ts',
    ];
    for (const rel of routes) {
      const full = path.join(process.cwd(), rel);
      expect(fs.existsSync(full), `expected ${rel} to exist`).toBe(true);
      const src = fs.readFileSync(full, 'utf8');
      expect(src, `${rel} must import withObserve`).toMatch(/withObserve/);
      expect(src, `${rel} must import from observe`).toMatch(/observe/);
      expect(src, `${rel} must call withObserve(`).toMatch(/withObserve\s*\(/);
    }
  });

  it('src/lib/observe.ts never mentions forbidden logging of body/audio/transcript/credential', () => {
    const p = path.join(process.cwd(), 'src/lib/observe.ts');
    expect(fs.existsSync(p), 'src/lib/observe.ts must exist').toBe(true);
    const src = fs.readFileSync(p, 'utf8');
    const lower = src.toLowerCase();
    // must reference SENTRY_DSN and console.error
    expect(src).toMatch(/console\.error/);
    expect(src).toMatch(/SENTRY_DSN/);
    // must not actively log body/audio/transcript/credential — i.e., no code that stringifies request body
    // We allow comments that say "never log transcript" but not code that does JSON.stringify(body) with those fields
    // So we check that implementation only serializes route/status/duration/error
    expect(src).toMatch(/route/);
    expect(src).toMatch(/status/);
    expect(src).toMatch(/duration/);
    // Ensure file contains a guard comment about not logging PII
    expect(lower).toMatch(/no.*pii|never.*transcript|never.*audio|without.*pii/i);
  });
});
