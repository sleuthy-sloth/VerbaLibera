import { initialCourses } from '@/features/curriculum/fixture';
import { teachingFor } from '@/features/curriculum/teaching';

it('provides sentence parts that match every authored lesson', () => {
  for (const course of initialCourses) for (const concept of course.concepts) {
    const note = teachingFor(concept);
    expect(note.pieces.length, concept.id).toBeGreaterThanOrEqual(3);
    expect(concept.modelDialogue.answer.toLowerCase(), concept.id).toContain(note.pieces[0][0].toLowerCase());
    expect(note.explanation.length, concept.id).toBeGreaterThan(80);
  }
});
