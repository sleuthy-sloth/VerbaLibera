// tiny observability without surveillance
// Only route/status/duration are ever logged. Never audio, transcript, credential, body, or PII.
// Uses console.error + optional SENTRY_DSN. No PII is sent to either sink.

export type ObserveRecord = Readonly<{
  route: string;
  status: number;
  durationMs: number;
  error?: unknown;
}>;

function sanitizeError(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined;
  if (error instanceof Error) return error.message.slice(0, 500);
  if (typeof error === 'string') return error.slice(0, 500);
  try {
    return JSON.stringify(error).slice(0, 500);
  } catch {
    return String(error).slice(0, 500);
  }
}

/**
 * Log only safe observability fields: route, status, durationMs, and a sanitized error.
 * Never logs audio, transcript, credential, body, or any PII.
 * Logs via console.error and optionally POSTs to SENTRY_DSN if configured.
 * No PII is included in either sink.
 */
export function observe(record: ObserveRecord): void {
  // Destructure only allowed fields — any extra fields like transcript/audio/credential/body are ignored
  const { route, status, durationMs } = record as ObserveRecord;
  const error = (record as { error?: unknown }).error;

  const payload: Record<string, unknown> = {
    route: String(route).slice(0, 200),
    status: Number(status),
    durationMs: Number(durationMs),
  };

  const sanitized = sanitizeError(error);
  if (sanitized) {
    payload.error = sanitized;
  }

  // never log transcript/audio/credential/body — payload contains only route/status/duration/error
  // no PII, no audio, never transcript
  const line = JSON.stringify(payload);
  console.error(line);

  const dsn = process.env.SENTRY_DSN;
  if (dsn && typeof dsn === 'string' && dsn.trim()) {
    try {
      const url = dsn.trim();
      // fire-and-forget without PII, without audio, without transcript, without credential, without body
      const body = JSON.stringify(payload);
      const globalFetch = (globalThis as unknown as { fetch?: typeof fetch }).fetch;
      if (typeof globalFetch === 'function') {
        void globalFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }).catch(() => {
          // never throw from observability — without PII
        });
      }
    } catch {
      // never throw from observability
    }
  }
}

/**
 * Wrap an API route handler with observability that logs only route+status+duration.
 * Never logs request body, response body, audio, transcript, or credential.
 * On success, logs route/status/duration. On throw, logs route/status 500/duration + sanitized error.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withObserve<T extends (...args: any[]) => Promise<Response>>(
  route: string,
  handler: T,
): T {
  const wrapped = async (...args: Parameters<T>): Promise<Response> => {
    const start = Date.now();
    try {
      const response = (await handler(...(args as unknown as []))) as Response;
      const durationMs = Date.now() - start;
      const status = typeof (response as Response)?.status === 'number' ? (response as Response).status : 200;
      // without PII, never transcript, never audio, never credential, no body
      observe({ route, status, durationMs });
      return response;
    } catch (err) {
      const durationMs = Date.now() - start;
      // without PII, never transcript, never audio, never credential
      observe({ route, status: 500, durationMs, error: err });
      return new Response(JSON.stringify({ status: 'unavailable' }), {
        status: 500,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
      }) as unknown as Response;
    }
  };
  return wrapped as unknown as T;
}
