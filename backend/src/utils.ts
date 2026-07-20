export function dtoQueryNumber({ value }: { value: unknown }): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Random delay in milliseconds in range [0, maxSeconds] (whole seconds).
 * Default maxSeconds matches URL_DELAY_MAX_SECONDS (see configuration.ts).
 */
export function randomDelay(maxSeconds = 10): number {
  const seconds = Math.floor(Math.random() * (maxSeconds + 1));
  return seconds * 1000;
}

export { toErrorMessage } from './common/errors';
