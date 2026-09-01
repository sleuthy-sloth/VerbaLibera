import { NextResponse } from 'next/server';
import { MAX_AUDIO_BYTES, transcribeVoiceResponse } from '@/lib/voice-service';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

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
export async function POST(request: Request) {
  const contentLengthHeader = request.headers.get('Content-Length');
  if (contentLengthHeader !== null) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_TOTAL_BODY_BYTES) {
      return oversizedResponse();
    }
  }

  let formData: FormData;
  if (contentLengthHeader === null && request.body !== null) {
    // A missing Content-Length means the body is streamed/chunked; do not trust the
    // client. Buffer it under the total body cap before handing it to the parser.
    const body = await readBoundedBody(request, MAX_TOTAL_BODY_BYTES);
    if (body === null) {
      return oversizedResponse();
    }

    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body,
    });

    try {
      formData = await boundedRequest.formData();
    } catch {
      return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
    }
  } else {
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
    }
  }

  if (!formData.has('audio')) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const result = await transcribeVoiceResponse(formData);
  const status = result.status === 'invalid_request' ? 400 : result.status === 'unavailable' ? 503 : 200;
  return NextResponse.json(result, { status, headers: NO_STORE_HEADERS });
}
