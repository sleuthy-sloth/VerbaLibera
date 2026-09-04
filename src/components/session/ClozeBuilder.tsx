'use client';

import { useMemo, useState } from 'react';
import styles from './session.module.css';

export type ClozePart = Readonly<{ kind: 'text'; value: string } | { kind: 'blank'; index: number }>;

const BLANK_PATTERN = /____+/g;

// Split a drill template on ____ runs so each blank renders its own input.
// Blank indexes follow template order, which is also assembly order.
export function splitClozeTemplate(template: string): ClozePart[] {
  const parts: ClozePart[] = [];
  let last = 0;
  let index = 0;
  for (let match = BLANK_PATTERN.exec(template); match !== null; match = BLANK_PATTERN.exec(template)) {
    if (match.index > last) parts.push({ kind: 'text', value: template.slice(last, match.index) });
    parts.push({ kind: 'blank', index: index++ });
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push({ kind: 'text', value: template.slice(last) });
  return parts;
}

type ClozeBuilderProps = Readonly<{
  template: string;
  onAssemble: (text: string) => void;
}>;

export function ClozeBuilder({ template, onAssemble }: ClozeBuilderProps) {
  const parts = useMemo(() => splitClozeTemplate(template), [template]);
  const blankCount = parts.filter((part) => part.kind === 'blank').length;
  const [fills, setFills] = useState<readonly string[]>([]);

  const fill = (index: number, value: string) => {
    const next = [...fills];
    next[index] = value;
    setFills(next);
    const complete = parts.every((part) => part.kind === 'text' || (next[part.index] ?? '').trim() !== '');
    if (!complete) {
      onAssemble('');
      return;
    }
    let assembled = '';
    for (const part of parts) {
      assembled += part.kind === 'text' ? part.value : (next[part.index] ?? '').trim();
    }
    onAssemble(assembled.replace(/\s+/g, ' '));
  };

  return (
    <div className={styles.responseSection}>
      <p className={styles.eyebrow}>Fill in the blank{blankCount === 1 ? '' : 's'}</p>
      <p className={styles.assembled} aria-live="polite">
        {parts.map((part, position) =>
          part.kind === 'text' ? (
            <span key={`t-${position}`}>{part.value}</span>
          ) : (
            <span key={`b-${position}`} aria-hidden="true">
              {' '}
              …{' '}
            </span>
          ),
        )}
      </p>
      {parts
        .filter((part) => part.kind === 'blank')
        .map((part) =>
          part.kind === 'blank' ? (
            <div key={`blank-${part.index}`}>
              <label className={styles.eyebrow} htmlFor={`cloze-blank-${part.index}`}>
                Blank {part.index + 1}
              </label>
              <input
                id={`cloze-blank-${part.index}`}
                className={styles.responseInput}
                type="text"
                autoComplete="off"
                value={fills[part.index] ?? ''}
                onChange={(event) => fill(part.index, event.target.value)}
              />
            </div>
          ) : null,
        )}
    </div>
  );
}
