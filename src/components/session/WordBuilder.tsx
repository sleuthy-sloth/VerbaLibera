'use client';

import { useMemo, useState } from 'react';
import styles from './session.module.css';

// Deterministic shuffle: same drill id always deals the same token order,
// so snapshots stay stable and learners can't rely on position memory
// across sessions... (within a session the order is fixed; across content
// each drill shuffles differently).
export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffledTokens(drillId: string, text: string): string[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const rand = mulberry32(hashSeed(drillId));
  const order = tokens.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order.map((index) => tokens[index]!);
}

type WordBuilderProps = Readonly<{
  drillId: string;
  target: string;
  onAssemble: (text: string) => void;
}>;

export function WordBuilder({ drillId, target, onAssemble }: WordBuilderProps) {
  const tokens = useMemo(() => shuffledTokens(drillId, target), [drillId, target]);
  const [picked, setPicked] = useState<readonly number[]>([]);

  const remaining = tokens.map((_, index) => index).filter((index) => !picked.includes(index));
  const assembled = picked.map((index) => tokens[index]).join(' ');

  const pick = (index: number) => {
    const next = [...picked, index];
    setPicked(next);
    onAssemble(next.map((i) => tokens[i]).join(' '));
  };

  const clear = () => {
    setPicked([]);
    onAssemble('');
  };

  return (
    <div className={styles.responseSection}>
      <p className={styles.eyebrow}>Your sentence</p>
      <p className={styles.assembled} aria-live="polite">
        {assembled || 'Tap the words below in order.'}
      </p>
      <div role="group" aria-label="Word tiles" className={styles.tokenBank}>
        {remaining.map((index) => (
          <button
            key={`${tokens[index]}-${index}`}
            type="button"
            className={styles.token}
            onClick={() => pick(index)}
          >
            {tokens[index]}
          </button>
        ))}
      </div>
      {picked.length > 0 && (
        <button type="button" className={styles.tokenClear} onClick={clear}>
          Clear sentence
        </button>
      )}
    </div>
  );
}
