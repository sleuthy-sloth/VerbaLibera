import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/answer-check/route';

const NO_STORE = 'no-store';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('answer-check route', () => {
  it('rejects a declared oversized request before reading the body', async () => {
    const request = new Request('http://localhost/api/answer-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '2561',
      },
      body: JSON.stringify({ courseSlug: 'x', contentId: 'y', drillId: 'z', response: 'a' }),
    });
    const json = vi.spyOn(request, 'json');

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(response.headers.get('Cache-Control')).toBe(NO_STORE);
    expect(json).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ status: 'request_too_large' });
  });

  it('bounds a streamed body without trusting a missing content-length header', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(2561)));
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/answer-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    const json = vi.spyOn(request, 'json');

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(response.headers.get('Cache-Control')).toBe(NO_STORE);
    expect(json).not.toHaveBeenCalled();
  });

  it('returns invalid_request for unparseable JSON', async () => {
    const request = new Request('http://localhost/api/answer-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe(NO_STORE);
    await expect(response.json()).resolves.toEqual({ status: 'invalid_request' });
  });

  it.each([
    { body: {}, label: 'empty body' },
    { body: { courseSlug: '', contentId: 'y', drillId: 'z', response: 'a' }, label: 'empty courseSlug' },
    { body: { courseSlug: 'x', contentId: 'y', drillId: 'z', response: '' }, label: 'empty response' },
    {
      body: { courseSlug: 'x', contentId: 'y', drillId: 'z', response: 'a'.repeat(501) },
      label: 'response too long',
    },
  ])('returns invalid_request for schema-invalid body ($label)', async ({ body }) => {
    const request = new Request('http://localhost/api/answer-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe(NO_STORE);
    await expect(response.json()).resolves.toEqual({ status: 'invalid_request' });
  });

  it('returns invalid_request for an unresolvable drill', async () => {
    const request = new Request('http://localhost/api/answer-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseSlug: 'english-to-french',
        contentId: 'missing-pattern',
        drillId: 'fr-ordering-politely-drill',
        response: 'Je voudrais un thé.',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe(NO_STORE);
    await expect(response.json()).resolves.toEqual({ status: 'invalid_request' });
  });

  it('returns an exact-path verdict with no-store header', async () => {
    const request = new Request('http://localhost/api/answer-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseSlug: 'english-to-french',
        contentId: 'fr-ordering-politely',
        drillId: 'fr-ordering-politely-drill',
        response: 'Je voudrais un thé, s’il vous plaît.',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(NO_STORE);
    await expect(response.json()).resolves.toEqual({
      verdict: 'exact',
      matchedVariant: 'Je voudrais un thé, s’il vous plaît.',
      limited: false,
    });
  });
});
