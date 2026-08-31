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
});
