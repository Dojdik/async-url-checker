import { computeJobTimeoutMs } from './configuration';

describe('computeJobTimeoutMs', () => {
  it('uses base when it is larger than per-url total', () => {
    expect(computeJobTimeoutMs(1, 60_000, 12_000)).toBe(60_000);
  });

  it('scales with url count', () => {
    expect(computeJobTimeoutMs(10, 60_000, 12_000)).toBe(120_000);
  });
});
