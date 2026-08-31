import { afterEach, expect, it, vi } from 'vitest';
import {
  getVoiceHealth,
  transcribeVoiceResponse,
} from '@/lib/voice-service';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('local voice service client', () => {
  it('fails closed when no local voice service URL is configured', async () => {
    // Break caught: an unset local service endpoint is treated as voice availability.
    await expect(
      getVoiceHealth({ serviceUrl: undefined, fetchImpl: fetch }),
    ).resolves.toEqual({ available: false });
  });

  it('does not expose a malformed local health response as available', async () => {
    // Break caught: an unexpected local response enables a learner voice flow.
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"status":"unknown"}', {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      getVoiceHealth({ serviceUrl: 'http://127.0.0.1:8090', fetchImpl }),
    ).resolves.toEqual({ available: false });
  });

  it('returns an unavailable result rather than forwarding audio without configuration', async () => {
    // Break caught: learner audio is sent despite the optional local service being disabled.
    const formData = new FormData();
    formData.set('audio', new File(['voice'], 'answer.webm', { type: 'audio/webm' }));
    formData.set('language', 'fr');

    await expect(
      transcribeVoiceResponse(formData, {
        serviceUrl: undefined,
        fetchImpl: fetch,
      }),
    ).resolves.toEqual({ status: 'unavailable' });
  });

  it('returns only the transient transcript from a valid local response', async () => {
    // Break caught: local transcript proxy responses expose additional learner recording metadata.
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"status":"ok","transcript":"Je voudrais un café."}', {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const formData = new FormData();
    formData.set('audio', new File(['voice'], 'answer.webm', { type: 'audio/webm' }));
    formData.set('language', 'fr');

    await expect(
      transcribeVoiceResponse(formData, {
        serviceUrl: 'http://127.0.0.1:8090',
        fetchImpl,
      }),
    ).resolves.toEqual({ status: 'ok', transcript: 'Je voudrais un café.' });
  });
});
