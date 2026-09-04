import type { CEFRLevel, ConceptFixture } from '@/features/curriculum/types';
import type { PaceInput, PlanItem, PlanWeek, StudyPlan } from './types';

const MAX_ITEMS_PER_SESSION = 14;
const DAY_MS = 86_400_000;

const CEFR_RANK: Record<CEFRLevel, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

// Teach/drill/review share per week, shifting from instruction toward
// practice as the level rises.
const RATIOS: Record<'early' | 'mid' | 'upper', readonly [number, number, number]> = {
  early: [0.4, 0.4, 0.2],
  mid: [0.3, 0.4, 0.3],
  upper: [0.2, 0.4, 0.4],
};

function ratioBand(level: CEFRLevel): keyof typeof RATIOS {
  if (CEFR_RANK[level] <= 0) return 'early';
  if (CEFR_RANK[level] <= 1) return 'mid';
  return 'upper';
}

function addDaysUtc(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  const base = Date.UTC(year!, month! - 1, day!);
  const out = new Date(base + days * DAY_MS);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${out.getUTCFullYear()}-${pad(out.getUTCMonth() + 1)}-${pad(out.getUTCDate())}`;
}

// Placement above A1 unlocks a stretch drill where the concept has one.
// Otherwise use the first productive drill, then fall back to any drill.
function mainDrillId(concept: ConceptFixture, stretchUnlocked: boolean): string | null {
  const stretch = stretchUnlocked
    ? concept.drills.find((drill) => drill.kind === 'CLOZE')
    : undefined;
  if (stretch) return stretch.id;

  const production = concept.drills.find(
    (drill) => drill.kind === 'SUBSTITUTION' || drill.kind === 'TRANSFORMATION',
  );
  return (production ?? concept.drills[0])?.id ?? null;
}

// Pure and idempotent: the same input and concepts always yield the same
// weeks. Guests run this in the browser; signed-in runs reuse it server-side.
export function generatePlan(input: PaceInput, concepts: readonly ConceptFixture[]): StudyPlan {
  const ordered = [...concepts].sort((a, b) => a.position - b.position);
  const startIndex = Math.max(
    0,
    ordered.findIndex((concept) => concept.id === input.startConceptId),
  );
  const remaining = ordered.slice(startIndex === -1 ? 0 : startIndex);
  const stretchUnlocked = input.startCefr !== 'A1';
  const weeklyBudget = input.daysPerWeek * Math.min(MAX_ITEMS_PER_SESSION, input.minutesPerDay);

  const taught: ConceptFixture[] = [];
  const drilledCounts = new Map<string, number>();
  const weeks: PlanWeek[] = [];
  let weekIndex = 0;

  while (remaining.length > 0 && weeklyBudget > 0) {
    const batchLevel = remaining[0]!.cefrLevel;
    const [teachShare, drillShare] = RATIOS[ratioBand(batchLevel)]!;

    const teachTake = remaining.splice(0, Math.round(weeklyBudget * teachShare));
    taught.push(...teachTake);

    const drillQuota = Math.round(weeklyBudget * drillShare);
    const byNeed = [...taught].sort((a, b) => {
      const need = (drilledCounts.get(a.id) ?? 0) - (drilledCounts.get(b.id) ?? 0);
      return need !== 0 ? need : a.position - b.position;
    });
    const drillItems: PlanItem[] = [];
    for (const concept of byNeed.slice(0, drillQuota)) {
      const drillId = mainDrillId(concept, stretchUnlocked);
      if (!drillId) continue;
      drillItems.push({ conceptId: concept.id, mode: 'drill', drillId });
      drilledCounts.set(concept.id, (drilledCounts.get(concept.id) ?? 0) + 1);
    }

    const used = teachTake.length + drillItems.length;
    const reviewQuota = Math.max(0, weeklyBudget - used);
    const reviewItems: PlanItem[] = [];
    for (let i = 0; i < reviewQuota && taught.length > 0; i++) {
      const concept = taught[i % taught.length]!;
      reviewItems.push({ conceptId: concept.id, mode: 'review' });
    }

    weeks.push({
      weekIndex,
      startsOn: addDaysUtc(input.startDate, weekIndex * 7),
      items: [
        ...teachTake.map((concept) => ({ conceptId: concept.id, mode: 'teach' as const })),
        ...drillItems,
        ...reviewItems,
      ],
    });
    weekIndex += 1;
  }

  const coveredRank = Math.max(0, ...taught.map((concept) => CEFR_RANK[concept.cefrLevel]!));
  const coveredThrough = (Object.keys(CEFR_RANK) as CEFRLevel[]).find(
    (level) => CEFR_RANK[level] === coveredRank,
  )!;
  const frontier =
    CEFR_RANK[input.targetLevel]! > coveredRank
      ? {
          coveredThrough,
          targetLevel: input.targetLevel,
          note: `This plan covers ${coveredThrough} content. ${input.targetLevel} material is still being authored — the plan stops instead of inventing weeks.`,
        }
      : null;

  return {
    courseSlug: input.courseSlug,
    targetLevel: input.targetLevel,
    daysPerWeek: input.daysPerWeek,
    minutesPerDay: input.minutesPerDay,
    startDate: input.startDate,
    weeks,
    frontier,
  };
}
