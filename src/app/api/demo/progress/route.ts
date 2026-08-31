import { NextResponse } from 'next/server';
import { demoProgress } from '@/features/progress/demo-progress';

export function GET() {
  return NextResponse.json(demoProgress, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
