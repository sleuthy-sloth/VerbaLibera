import { NextResponse } from 'next/server';

import { checkDrillAnswer, type AnswerCheckInput } from '@/lib/answer-checking';
import { withObserve } from '@/lib/observe';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 2560;

type BoundedJsonBody =
  | Readonly<{ status: 'ready'; body: unknown }>
  | Readonly<{ status: 'too_large' }>
  | Readonly<{ status: 'invalid_request' }>;

async function boundedJsonBody(request: Request): Promise<BoundedJsonBody> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) {
    return { status: 'too_large' };
  }

  const body = request.body;
  if (!body) {
    return { status: 'ready', body: null };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel('oversized');
        return { status: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { status: 'invalid_request' };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(bytes);
  try {
    return { status: 'ready', body: JSON.parse(text) };
  } catch {
    return { status: 'invalid_request' };
  }
}

function isValidInput(value: unknown): value is AnswerCheckInput {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  const { courseSlug, contentId, drillId, response } = record;
  if (typeof courseSlug !== 'string' || !courseSlug.trim()) {
    return false;
  }
  if (typeof contentId !== 'string' || !contentId.trim()) {
    return false;
  }
  if (typeof drillId !== 'string' || !drillId.trim()) {
    return false;
  }
  if (typeof response !== 'string') {
    return false;
  }
  const trimmed = response.trim();
  return trimmed.length >= 1 && trimmed.length <= 500;
}

async function postHandler(request: Request) {
  const bounded = await boundedJsonBody(request);
  if (bounded.status === 'too_large') {
    return NextResponse.json(
      { status: 'request_too_large' },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }
  if (bounded.status === 'invalid_request') {
    return NextResponse.json(
      { status: 'invalid_request' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (!isValidInput(bounded.body)) {
    return NextResponse.json(
      { status: 'invalid_request' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const result = await checkDrillAnswer(bounded.body);
    if (result === null) {
      return NextResponse.json(
        { status: 'invalid_request' },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    return NextResponse.json(result, { status: 200, headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}

export const POST = withObserve('/api/answer-check', postHandler);
