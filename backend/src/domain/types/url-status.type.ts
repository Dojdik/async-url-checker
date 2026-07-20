export const URL_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'failed',
] as const;

export type UrlStatus = (typeof URL_STATUSES)[number];

const TERMINAL_URL_STATUSES: ReadonlySet<UrlStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
]);

export function isTerminalUrlStatus(status: UrlStatus): boolean {
  return TERMINAL_URL_STATUSES.has(status);
}
