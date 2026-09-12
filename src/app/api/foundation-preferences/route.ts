import { z } from 'zod';
import { sessionTokenFromCookies } from '@/lib/auth/cookies';
import { validateCsrfRequest } from '@/lib/auth/csrf';
import { verifySessionToken } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { foundationPreferencesSchema } from '@/features/course-pack/foundation-preferences';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const packIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,99}$/);
const requestSchema = foundationPreferencesSchema.pick({ version: true, minutesPerDay: true, goal: true, listening: true });
async function context(request: Request) {
  const token = sessionTokenFromCookies(request.headers.get('cookie') ?? '');
  const userId = token ? (await verifySessionToken(token))?.userId : null;
  if (!userId) return reply({ error: 'Sign in to sync foundation preferences.' }, 401);
  const params = new URL(request.url).searchParams;
  if (params.has('userId') && params.get('userId') !== userId) return reply({ error: 'Your account changed. Reload this page.' }, 409);
  const packId = params.get('packId') ?? '';
  if (!packIdSchema.safeParse(packId).success) return reply({ error: 'Unknown foundation course.' }, 400);
  if (request.method !== 'GET') {
    if (!params.has('userId')) return reply({ error: 'Reload this page before saving.' }, 409);
    try {
      if (request.headers.get('origin') !== new URL(request.url).origin || !validateCsrfRequest(request)) return reply({ error: 'Refresh your sign-in before saving.' }, 403);
    } catch { return reply({ error: 'Invalid CSRF token.' }, 403); }
  }
  return { userId, packId };
}
export async function GET(request: Request) {
  const ctx = await context(request); if (ctx instanceof Response) return ctx;
  try {
    const stored = await prisma.foundationPreference.findUnique({ where: { userId_packId: ctx } });
    return reply({ userId: ctx.userId, preferences: stored ? { version: stored.version, packId: stored.packId, minutesPerDay: stored.minutesPerDay, goal: stored.goal, listening: stored.listening } : null });
  } catch { return reply({ error: 'Account preferences are unavailable. Please retry.' }, 503); }
}
export async function PUT(request: Request) {
  const ctx = await context(request); if (ctx instanceof Response) return ctx;
  let body: unknown;
  try { body = request.body ? await request.json() : null; } catch { return reply({ error: 'Invalid foundation preferences.' }, 400); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return reply({ error: 'Invalid foundation preferences.' }, 400);
  try {
    const saved = await prisma.foundationPreference.upsert({ where: { userId_packId: ctx }, create: { ...ctx, ...parsed.data }, update: parsed.data });
    return reply({ userId: ctx.userId, saved: true, preferences: { version: saved.version, packId: saved.packId, minutesPerDay: saved.minutesPerDay, goal: saved.goal, listening: saved.listening } });
  } catch { return reply({ error: 'Your preferences were not saved. Please retry.' }, 503); }
}
export async function DELETE(request: Request) {
  const ctx = await context(request); if (ctx instanceof Response) return ctx;
  try { await prisma.foundationPreference.deleteMany({ where: ctx }); return reply({ userId: ctx.userId, saved: true }); }
  catch { return reply({ error: 'Your preferences were not reset. Please retry.' }, 503); }
}
