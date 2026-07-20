const RANDOM_DELAY_MAX = 10;

export function dtoQueryNumber({ value }: { value: unknown }): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function randomDelay(): number {
  return Math.floor(Math.random() * RANDOM_DELAY_MAX) * 1000;
}
