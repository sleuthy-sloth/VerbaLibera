import { z } from 'zod';

export const foundationPreferencesSchema = z.object({
  version: z.literal(1),
  packId: z.string().regex(/^[a-z][a-z0-9-]{1,99}$/).nullable(),
  minutesPerDay: z.number().int().min(5).max(60),
  goal: z.enum(['balanced', 'review', 'new']),
  listening: z.enum(['available', 'off']),
  speaking: z.enum(['optional', 'off']),
  guidance: z.enum(['guided', 'balanced', 'independent']),
  preferredModes: z.array(z.enum(['read', 'listen', 'build', 'speak', 'visual'])).max(5),
});
export type FoundationPreferences = z.infer<typeof foundationPreferencesSchema>;
export const DEFAULT_FOUNDATION_PREFERENCES: FoundationPreferences = {
  version: 1, packId: null, minutesPerDay: 10, goal: 'balanced', listening: 'available', speaking: 'optional', guidance: 'balanced', preferredModes: [],
};
const key = (scope?: string | null) => `verbalibera-foundation-preferences${scope ? `-account-${encodeURIComponent(scope)}` : ''}`;
export function readFoundationPreferences(scope?: string | null): FoundationPreferences {
  if (typeof localStorage === 'undefined') return DEFAULT_FOUNDATION_PREFERENCES;
  try {
    const raw = localStorage.getItem(key(scope));
    if (!raw) return DEFAULT_FOUNDATION_PREFERENCES;
    const parsed = foundationPreferencesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_FOUNDATION_PREFERENCES;
  } catch { return DEFAULT_FOUNDATION_PREFERENCES; }
}
export function saveFoundationPreferences(value: FoundationPreferences, scope?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key(scope), JSON.stringify(foundationPreferencesSchema.parse(value)));
}
export function resetFoundationPreferences(scope?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key(scope));
}

/** Account synchronization is opt-in; guest preferences never make a network request. */
export async function loadAccountFoundationPreferences(scope: string, packId: string): Promise<FoundationPreferences | null> {
  const response = await fetch(`/api/foundation-preferences?userId=${encodeURIComponent(scope)}&packId=${encodeURIComponent(packId)}`, { credentials: 'same-origin', cache: 'no-store' });
  const body = await response.json() as { preferences?: unknown; error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Account preferences could not be loaded.');
  if (body.preferences == null) return null;
  return foundationPreferencesSchema.parse({ ...DEFAULT_FOUNDATION_PREFERENCES, ...body.preferences, packId });
}
export async function saveAccountFoundationPreferences(scope: string, value: FoundationPreferences, packId = value.packId): Promise<void> {
  if (!packId) throw new Error('Choose a foundation course before saving preferences.');
  const { csrfHeaders } = await import('@/lib/auth/cookies');
  const response = await fetch(`/api/foundation-preferences?userId=${encodeURIComponent(scope)}&packId=${encodeURIComponent(packId)}`, { method: 'PUT', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...csrfHeaders() }, body: JSON.stringify({ version: value.version, minutesPerDay: value.minutesPerDay, goal: value.goal, listening: value.listening }) });
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error ?? 'Account preferences could not be saved.'); }
}
export async function resetAccountFoundationPreferences(scope: string, packId: string): Promise<void> {
  const { csrfHeaders } = await import('@/lib/auth/cookies');
  const response = await fetch(`/api/foundation-preferences?userId=${encodeURIComponent(scope)}&packId=${encodeURIComponent(packId)}`, { method: 'DELETE', credentials: 'same-origin', cache: 'no-store', headers: csrfHeaders() });
  if (!response.ok) throw new Error('Account preferences could not be reset.');
}
