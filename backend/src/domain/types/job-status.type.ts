export const JOB_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'failed',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

const TERMINAL_JOB_STATUSES: ReadonlySet<JobStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
]);

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.has(status);
}

export function canCancelJob(status: JobStatus): boolean {
  return !isTerminalJobStatus(status);
}
