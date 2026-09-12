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
