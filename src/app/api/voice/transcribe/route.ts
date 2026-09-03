import { NextResponse } from 'next/server';
import { MAX_AUDIO_BYTES, transcribeVoiceResponse } from '@/lib/voice-service';
import { withObserve } from '@/lib/observe';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };
// Allow room for multipart metadata while keeping the learner audio itself capped at 1 MB.
const MAX_MULTIPART_REQUEST_BYTES = 1_064_000;
type BoundedMultipartRequest =
  | Readonly<{ status: 'ready'; request: Request }>
  | Readonly<{ status: 'too_large' }>
  | Readonly<{ status: 'invalid_request' }>;

async function boundedMultipartRequest(request: Request): Promise<BoundedMultipartRequest> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_MULTIPART_REQUEST_BYTES) {
    return { status: 'too_large' };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return {
      status: 'ready',
      request: new Request(request.url, { method: request.method, headers: request.headers }),
    };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > MAX_MULTIPART_REQUEST_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The response remains a size violation even if stream cleanup fails.
        }
        return { status: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { status: 'invalid_request' };
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  return { status: 'ready', request: new Request(request.url, { method: request.method, headers, body }) };
}

// Route-level total body bound: the 1,000,000 byte audio limit plus ~64 KB for multipart
// boundaries and metadata. Anything larger is rejected before reaching the parser.
const MAX_TOTAL_BODY_BYTES = MAX_AUDIO_BYTES + 64_000;

function oversizedResponse() {
  return NextResponse.json({ status: 'invalid_request' }, { status: 413, headers: NO_STORE_HEADERS });
}

/**
 * Reads a streamed request body up to `maxBytes` and returns its buffered bytes.
 * Returns `null` as soon as the accumulated bytes exceed the cap so the caller
 * can reject the request without ever invoking a multipart parser on an
 * unbounded body.
 */
async function readBoundedBody(request: Request, maxBytes: number): Promise<ArrayBuffer | null> {
  const body = request.body;
  if (!body) {
    return new ArrayBuffer(0);
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('oversized');
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer as ArrayBuffer;
}

/** Forwards a validated short response to an opted-in, same-host local voice service. */
async function postHandler(request: Request) {
  const boundedRequest = await boundedMultipartRequest(request);
  if (boundedRequest.status === 'too_large') {
    return NextResponse.json(
      { status: 'request_too_large' },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }
  if (boundedRequest.status === 'invalid_request') {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  let formData: FormData;
  try {
    formData = await boundedRequest.request.formData();
  } catch {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  if (!formData.has('audio')) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const result = await transcribeVoiceResponse(formData);
  const status = result.status === 'invalid_request' ? 400 : result.status === 'unavailable' ? 503 : 200;
  return NextResponse.json(result, { status, headers: NO_STORE_HEADERS });
}

export const POST = withObserve('/api/voice/transcribe', postHandler);
