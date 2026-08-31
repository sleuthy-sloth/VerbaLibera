import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/voice/health/route';
import { POST } from '@/app/api/voice/transcribe/route';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('local voice routes', () => {
  it('reports an unavailable optional service when its URL is not configured', async () => {
    // Break caught: the browser learns an internal service URL or a false positive health state.
    vi.stubEnv('VOXLIBRE_VOICE_SERVICE_URL', '');

    const response = await GET();

    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ available: false });
  });

  it('rejects a transcription request without an audio part', async () => {
    // Break caught: a malformed microphone request reaches the local voice service.
    const request = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      body: new FormData(),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ status: 'invalid_request' });
  });

  it('rejects a declared oversized multipart request before parsing form data', async () => {
    // Break caught: a body advertised as too large reaches a multipart parser before its bound.
    const request = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      headers: {
        'Content-Length': '1064001',
        'Content-Type': 'multipart/form-data; boundary=voice-boundary',
      },
      body: '--voice-boundary--',
    });
    const formData = vi.spyOn(request, 'formData');

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
  });

  it('bounds a streamed body without trusting a missing content-length header', async () => {
    // Break caught: chunked oversized bodies are freely parsed when content length is absent.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(1_064_001)));
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=voice-boundary' },
      body: stream,
      // Undici requires this non-standard field for a streamed request body.
      duplex: 'half',
    } as RequestInit);
    const formData = vi.spyOn(request, 'formData');

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
  });
});
