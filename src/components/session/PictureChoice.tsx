'use client';

import { useState } from 'react';
import type { DrillChoiceFixture } from '@/features/curriculum/types';
import styles from './session.module.css';

export type PictureVerdict = 'exact' | 'try_again';

type PictureChoiceProps = Readonly<{
  prompt: string;
  choices: readonly DrillChoiceFixture[];
  recallTarget: string;
  onVerdict: (verdict: PictureVerdict, choiceId: string) => void;
}>;

export function PictureChoice({ prompt, choices, recallTarget, onVerdict }: PictureChoiceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const select = (choiceId: string) => {
    if (selectedId !== null) return;
    setSelectedId(choiceId);
    onVerdict(choiceId === recallTarget ? 'exact' : 'try_again', choiceId);
  };

  return (
    <div className={styles.responseSection}>
      <p className={styles.prompt}>{prompt}</p>
      <div role="radiogroup" aria-label="Picture choices" className={styles.pictureGrid}>
        {choices.map((choice) => {
          const selected = selectedId === choice.id;
          const correct = selectedId !== null && choice.id === recallTarget;
          return (
            <button
              key={choice.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={choice.alt}
              data-correct={selectedId !== null ? correct || undefined : undefined}
              data-selected={selected || undefined}
              className={styles.pictureChoice}
              onClick={() => select(choice.id)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  select(choice.id);
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={choice.imageUrl} alt="" width={400} height={300} loading="lazy" />
              <span className={styles.pictureAlt}>{choice.alt}</span>
            </button>
          );
        })}
      </div>
      {selectedId !== null && (
        <p className={styles.status} aria-live="polite">
          {selectedId === recallTarget
            ? 'That is the right picture.'
            : 'Not that one — compare the pictures with the word and continue.'}
        </p>
      )}
    </div>
  );
}
