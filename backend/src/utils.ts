const RANDOM_DELAY_MAX = 10

export function dtoQueryNumber({ value }) {
    if (value === undefined || value === null) return 0;
    const parsed = parseInt(value);
    return isNaN(parsed) ? 0 : parsed;
}

export function randomDelay(): number {
    return Math.floor(Math.random() * RANDOM_DELAY_MAX) * 1000
}