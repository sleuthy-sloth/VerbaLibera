import { frenchPlacementItems, type PlacementItem } from '@/features/placement/items';
import {
  nextAdaptivePlacementItem,
  scoreAdaptivePlacement,
} from '@/features/placement/adaptive';

function answer(item: PlacementItem, correct: boolean): Record<string, string> {
  if (!correct) return { [item.id]: 'wrong answer' };
  return {
    [item.id]: item.kind === 'CHOICE' ? item.answerKey ?? '' : item.acceptedResponses[0] ?? '',
  };
}

function answersFor(itemIds: readonly string[], correct: boolean): Record<string, string> {
  return Object.assign(
    {},
    ...itemIds.map((id) => answer(frenchPlacementItems.find((item) => item.id === id)!, correct)),
  );
}

describe('adaptive placement', () => {
  it('ends early at A1 after three unsuccessful foundation checks', () => {
    const firstThree = frenchPlacementItems.slice(0, 3);
    const answers = answersFor(firstThree.map((item) => item.id), false);

    expect(nextAdaptivePlacementItem(frenchPlacementItems, answers, firstThree.map((item) => item.id))).toBeNull();
    expect(scoreAdaptivePlacement(frenchPlacementItems, answers)).toMatchObject({
      band: 'A1',
      total: 3,
      startCefr: 'A1',
    });
  });

  it('unlocks the A2 checkpoint only after strong A1 evidence', () => {
    const a1 = frenchPlacementItems.filter((item) => item.band === 'A1').slice(0, 3);
    const answers = answersFor(a1.map((item) => item.id), true);
    const next = nextAdaptivePlacementItem(frenchPlacementItems, answers, a1.map((item) => item.id));

    expect(next).toMatchObject({ id: 'fr-place-6', band: 'A2' });
  });

  it('unlocks the B1 checkpoint only after strong A2 evidence', () => {
    const a1AndA2 = frenchPlacementItems.filter((item) => item.band !== 'B1').slice(0, 6);
    const answers = answersFor(a1AndA2.map((item) => item.id), true);
    const next = nextAdaptivePlacementItem(
      frenchPlacementItems,
      answers,
      a1AndA2.map((item) => item.id),
    );

    expect(next).toMatchObject({ id: 'fr-place-11', band: 'B1' });
  });

  it('reports B1+ only after a strong B1 checkpoint', () => {
    const items = frenchPlacementItems.slice(0, 9);
    const answers = answersFor(items.map((item) => item.id), true);

    expect(scoreAdaptivePlacement(frenchPlacementItems, answers)).toMatchObject({
      score: 9,
      total: 9,
      band: 'B1+',
      startCefr: 'B1',
      aboveContent: true,
    });
  });
});
