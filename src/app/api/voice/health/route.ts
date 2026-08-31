import { NextResponse } from 'next/server';
import { getVoiceHealth } from '@/lib/voice-service';

/** Reveals only whether the optional local voice companion can be reached. */
export async function GET() {
  return NextResponse.json(await getVoiceHealth(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
