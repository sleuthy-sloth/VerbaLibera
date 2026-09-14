/**
 * The network half of practice preferences.
 *
 * Kept out of `foundation-preferences` because that module is shared with the
 * offline and portable bundles: the portable artifact is a single file served
 * under `connect-src 'none'`, and `scripts/portable/verify.ts` fails the build
 * if any `/api/` literal reaches it. Only the hosted shell
 * (`HostedCourseWorkspace`) imports this and passes it down, the same way it
 * injects `synchronize` and the account practice controls.
 *
 * Account synchronization is opt-in; guest preferences never make a request.
 */
import {
  DEFAULT_FOUNDATION_PREFERENCES,
  foundationPreferencesSchema,
  type FoundationPreferences,
} from './foundation-preferences';

/** What `CourseWorkspace` calls when a signed-in scope is present. */
export type AccountPreferencesTransport = {
  load: (scope: string, packId: string) => Promise<FoundationPreferences | null>;
  save: (scope: string, value: FoundationPreferences) => Promise<void>;
  reset: (scope: string, packId: string) => Promise<void>;
};

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

/** The transport the hosted shell hands to `CourseWorkspace`. */
export const accountPreferencesTransport: AccountPreferencesTransport = {
  load: loadAccountFoundationPreferences,
  save: saveAccountFoundationPreferences,
  reset: resetAccountFoundationPreferences,
};
