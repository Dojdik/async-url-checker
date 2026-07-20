/** Max artificial delay after HEAD before persisting result (seconds). */
const RANDOM_DELAY_MAX_SECONDS = 10;

export function dtoQueryNumber({ value }: { value: unknown }): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Random delay in milliseconds in range [0, 10] seconds (inclusive of whole seconds).
 */
export function randomDelay(): number {
  const seconds = Math.floor(Math.random() * (RANDOM_DELAY_MAX_SECONDS + 1));
  return seconds * 1000;
}
