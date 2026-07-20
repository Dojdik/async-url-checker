/** Domain types aligned with backend DTOs. */

export const JobStatus = {
  Pending: 'pending',
  InProgress: 'in_progress',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Failed: 'failed',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/** API-facing URL status (completed→success, failed→error). */
export const ApiUrlStatus = {
  Pending: 'pending',
  InProgress: 'in_progress',
  Success: 'success',
  Error: 'error',
  Cancelled: 'cancelled',
} as const;

export type ApiUrlStatus = (typeof ApiUrlStatus)[keyof typeof ApiUrlStatus];

export const RequestStatus = {
  Idle: 'idle',
  Loading: 'loading',
  Succeeded: 'succeeded',
  Failed: 'failed',
} as const;

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export interface JobUrlStats {
  succeeded: number;
  failed: number;
  pending: number;
  in_progress: number;
  cancelled: number;
}

/** GET /api/jobs item */
export interface JobListItem {
  id: number;
  createdAt: string;
  status: JobStatus;
  urlsCount: number;
  stats: JobUrlStats;
}

export interface JobUrlDetail {
  url: string;
  status: ApiUrlStatus;
  httpStatus?: number;
  error?: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
}

/** GET /api/jobs/:id */
export interface JobDetail {
  id: number;
  createdAt: string;
  updatedAt: string;
  status: JobStatus;
  urls: JobUrlDetail[];
}

/** POST /api/jobs response */
export interface JobCreated {
  id: number;
  status: JobStatus;
  createdAt: string;
}

export function isJobActive(status: JobStatus): boolean {
  return status === JobStatus.Pending || status === JobStatus.InProgress;
}
