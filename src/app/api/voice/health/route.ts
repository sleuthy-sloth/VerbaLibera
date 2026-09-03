import { NextResponse } from 'next/server';
import { getVoiceHealth } from '@/lib/voice-service';
import { withObserve } from '@/lib/observe';

/** Reveals only whether the optional local voice companion can be reached. */
async function getHandler() {
  return NextResponse.json(await getVoiceHealth(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const GET = withObserve('/api/voice/health', getHandler);
