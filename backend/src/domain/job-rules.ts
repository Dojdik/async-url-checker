import type { IJob } from '../interfaces/job.interface';
import type { IJobUrl } from '../interfaces/job-url.interface';
import type { JobStatus } from './types/job-status.type';
import type { UrlStatus } from './types/url-status.type';

export type UrlStatusCounts = Record<UrlStatus, number>;

export function emptyUrlStatusCounts(): UrlStatusCounts {
  return {
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    failed: 0,
  };
}

/** Single pass over URLs — used by API stats and resolveJobStatus. */
export function countUrlStatuses(urls: IJobUrl[]): UrlStatusCounts {
  const counts = emptyUrlStatusCounts();
  for (const url of urls) {
    counts[url.status] += 1;
  }
  return counts;
}

/**
 * Mark not-started URLs as cancelled (in place).
 * In-progress / finished URLs are left unchanged.
 */
export function cancelPendingUrls(job: IJob, now: Date = new Date()): void {
  for (const url of job.urls) {
    if (url.status === 'pending') {
      url.status = 'cancelled';
      url.endedAt = now;
    }
  }
}

/**
 * Derive terminal job status from URL outcomes after processing.
 * If the job was cancelled mid-run, prefer `cancelled`.
 */
export function resolveJobStatusFromUrls(
  urls: IJobUrl[],
  options?: { forceCancelled?: boolean },
): JobStatus {
  if (options?.forceCancelled) {
    return 'cancelled';
  }

  const counts = countUrlStatuses(urls);
  const total = urls.length;

  if (counts.cancelled > 0 && counts.pending === 0 && counts.in_progress === 0) {
    return 'cancelled';
  }

  if (total > 0 && counts.failed === total) {
    return 'failed';
  }

  return 'completed';
}
