/** Single source of truth for per-URL statuses. */
export const UrlStatus = {
  Pending: 'pending',
  InProgress: 'in_progress',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Failed: 'failed',
} as const;

export type UrlStatus = (typeof UrlStatus)[keyof typeof UrlStatus];

/** Ordered list for swagger / validation. */
export const URL_STATUSES = [
  UrlStatus.Pending,
  UrlStatus.InProgress,
  UrlStatus.Completed,
  UrlStatus.Cancelled,
  UrlStatus.Failed,
] as const satisfies readonly UrlStatus[];

const TERMINAL_URL_STATUSES: ReadonlySet<UrlStatus> = new Set([
  UrlStatus.Completed,
  UrlStatus.Failed,
  UrlStatus.Cancelled,
]);

export function isTerminalUrlStatus(status: UrlStatus): boolean {
  return TERMINAL_URL_STATUSES.has(status);
}
