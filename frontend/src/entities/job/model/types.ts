/** Domain types aligned with backend DTOs. */

export type JobStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type ApiUrlStatus =
  | 'pending'
  | 'in_progress'
  | 'success'
  | 'error'
  | 'cancelled';

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

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export function isJobActive(status: JobStatus): boolean {
  return status === 'pending' || status === 'in_progress';
}
