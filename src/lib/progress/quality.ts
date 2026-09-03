export type Verdict = 'exact' | 'close' | 'try_again';

export function qualityFromVerdict(verdict: Verdict, latencyMs: number | null | undefined): 0 | 1 | 2 | 3 | 4 | 5 {
  if (verdict === 'try_again') return 0;

  // Validate latency sane bound (0 to 5 minutes)
  if (latencyMs !== null && latencyMs !== undefined) {
    if (!Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > 300_000) {
      throw new RangeError('latencyMs must be a finite number between 0 and 300000');
    }
  }

  const latency = latencyMs ?? null;

  if (verdict === 'exact') {
    if (latency === null) return 3;
    if (latency < 3000) return 5;
    if (latency <= 8000) return 4;
    return 3;
  }

  // close
  if (latency === null) return 1;
  if (latency < 3000) return 3;
  if (latency <= 8000) return 2;
  return 1;
}
