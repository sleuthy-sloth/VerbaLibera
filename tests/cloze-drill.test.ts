import { initialCourses } from '@/features/curriculum/fixture';
import { resolveSessionContent } from '@/features/session/resolve-session-content';

function frenchClozeDrills() {
  const french = initialCourses.find((course) => course.slug === 'english-to-french');
  return french?.concepts.flatMap((concept) =>
    concept.drills.filter((drill) => drill.kind === 'CLOZE').map((drill) => ({ concept, drill })),
  ) ?? [];
}

describe('CLOZE drills', () => {
  it('ships B1 cloze drills on French patterns with blank templates', () => {
    const cloze = frenchClozeDrills();
    expect(cloze.length).toBeGreaterThanOrEqual(2);
    for (const { drill } of cloze) {
      expect(drill.cefrLevel).toBe('B1');
      expect(drill.prompt).toMatch(/____/);
      expect(drill.acceptedResponses.length).toBeGreaterThanOrEqual(1);
      expect(drill.recallTarget).toBe(drill.acceptedResponses[0]);
    }
  });

  it('resolves a cloze drill through session content', () => {
    const [first] = frenchClozeDrills();
    expect(first).toBeDefined();
    const resolved = resolveSessionContent('english-to-french', first!.concept.id, first!.drill.id);
    expect(resolved?.drill?.kind).toBe('CLOZE');
  });
});
