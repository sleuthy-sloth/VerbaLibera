'use client';

import { useEffect, useState } from 'react';
import styles from './toast.module.css';

type ToastProps = Readonly<{
  message: string | null;
  onDismiss?: () => void;
  durationMs?: number;
}>;

export function Toast({ message, onDismiss, durationMs = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      // eslint-disable-next-line -- intentional reset when message clears
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message || !visible) return null;

  return (
    <div role="status" aria-live="polite" className={styles.toast}>
      {message}
    </div>
  );
}
