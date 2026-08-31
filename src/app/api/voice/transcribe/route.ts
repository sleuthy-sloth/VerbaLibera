import { NextResponse } from 'next/server';
import { transcribeVoiceResponse } from '@/lib/voice-service';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

/** Forwards a validated short response to an opted-in, same-host local voice service. */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
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
