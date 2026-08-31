import { qualityFromConstruction } from '@/features/srs/quality';

describe('qualityFromConstruction', () => {
  it('scores a fast inaccurate construction as a failed review', () => {
    expect(
      qualityFromConstruction({
        isAccurate: false,
        latencyMs: 50,
        targetLatencyMs: 3_000,
      }),
    ).toBe(0);
  });

  it('gives an accurate construction without timing a neutral passing quality', () => {
    expect(
      qualityFromConstruction({
        isAccurate: true,
        latencyMs: null,
        targetLatencyMs: 3_000,
      }),
    ).toBe(3);
  });

  it('lowers the passing quality as accurate construction latency exceeds the drill target', () => {
    expect(
      qualityFromConstruction({
        isAccurate: true,
        latencyMs: 3_000,
        targetLatencyMs: 3_000,
      }),
    ).toBe(5);
    expect(
      qualityFromConstruction({
        isAccurate: true,
        latencyMs: 6_000,
        targetLatencyMs: 3_000,
      }),
    ).toBe(4);
    expect(
      qualityFromConstruction({
        isAccurate: true,
        latencyMs: 6_001,
        targetLatencyMs: 3_000,
      }),
    ).toBe(3);
  });

  it.each([
    ['a negative latency', -1],
    ['a non-finite latency', Number.POSITIVE_INFINITY],
  ])('rejects %s', (_description, latencyMs) => {
    expect(() =>
      qualityFromConstruction({
        isAccurate: true,
        latencyMs,
        targetLatencyMs: 3_000,
      }),
    ).toThrow('latencyMs');
  });
});
