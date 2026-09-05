import type { ConceptFixture } from '@/features/curriculum/types';
import { teachingFor } from '@/features/curriculum/teaching';
import styles from './session.module.css';

export function TeachingNotes({ concept, language }: { concept: ConceptFixture; language: string }) {
  const note = teachingFor(concept);
  return (
    <div className={styles.teachingNotes}>
      <h3>How this works</h3>
      <p>{note.explanation}</p>
      <h3>Build it piece by piece</h3>
      <dl className={styles.phrasePieces}>
        {note.pieces.map(([phrase, meaning]) => <div key={phrase}><dt lang={language}>{phrase}</dt><dd>{meaning}</dd></div>)}
      </dl>
      <p className={styles.notice}>{note.tip}</p>
      <h3>Worked example</h3>
      <p>{concept.drills[0]?.prompt}</p>
      <p lang={language}><strong>{concept.drills[0]?.recallTarget}</strong></p>
      <p>Compare this with the model above. Notice what stayed the same and what changed. Read both aloud before continuing; this part is for learning, not scoring.</p>
    </div>
  );
}
