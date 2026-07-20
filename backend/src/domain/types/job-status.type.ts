/** Single source of truth for job lifecycle statuses. */
export const JobStatus = {
  Pending: 'pending',
  InProgress: 'in_progress',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Failed: 'failed',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/** Ordered list for swagger / validation. */
export const JOB_STATUSES = [
  JobStatus.Pending,
  JobStatus.InProgress,
  JobStatus.Completed,
  JobStatus.Cancelled,
  JobStatus.Failed,
] as const satisfies readonly JobStatus[];

const TERMINAL_JOB_STATUSES: ReadonlySet<JobStatus> = new Set([
  JobStatus.Completed,
  JobStatus.Failed,
  JobStatus.Cancelled,
]);

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.has(status);
}

export function canCancelJob(status: JobStatus): boolean {
  return !isTerminalJobStatus(status);
}
