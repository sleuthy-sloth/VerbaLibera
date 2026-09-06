// Maps placement bands to foundation-pack entry lessons.
//
// Placement items test travel survival; the real course depth lives in the
// 24-lesson foundation packs. A1 misses point at the unit that reteaches the
// failed pattern; A2/B1 scores skip the head of the pack. Courses without a
// foundation pack get null and the quiz UI stays travel-only.
const ENTRY: Record<string, { items: Record<string, string>; A2: string; B1: string }> = {
  'english-to-italian': {
    items: {
      'it-place-1': 'it-first-words-foundation',
      'it-place-2': 'it-food-foundation',
      'it-place-3': 'it-transport-foundation',
      'it-place-4': 'it-market-foundation',
      'it-place-5': 'it-requests-foundation',
    },
    A2: 'it-negation-foundation',
    B1: 'it-days-foundation',
  },
  'english-to-french': {
    items: {
      'fr-place-1': 'fr-first-words-foundation',
      'fr-place-2': 'fr-food-foundation',
      'fr-place-3': 'fr-transport-foundation',
      'fr-place-4': 'fr-market-foundation',
      'fr-place-5': 'fr-requests-foundation',
    },
    A2: 'fr-negation-foundation',
    B1: 'fr-days-foundation',
  },
};

export function foundationEntryLesson(
  courseSlug: string,
  band: 'A1' | 'A2' | 'B1',
  itemId?: string,
): string | null {
  const entry = ENTRY[courseSlug];
  if (!entry) return null;
  if (band === 'A1') return (itemId && entry.items[itemId]) ?? Object.values(entry.items)[0]!;
  return entry[band];
}
