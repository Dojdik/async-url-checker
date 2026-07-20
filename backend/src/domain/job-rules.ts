import type { IJob } from '../interfaces/job.interface';
import type { IJobUrl } from '../interfaces/job-url.interface';
import { JobStatus, type JobStatus as JobStatusType } from './types/job-status.type';
import { UrlStatus, type UrlStatus as UrlStatusType } from './types/url-status.type';

export type UrlStatusCounts = Record<UrlStatusType, number>;

export function emptyUrlStatusCounts(): UrlStatusCounts {
  return {
    [UrlStatus.Pending]: 0,
    [UrlStatus.InProgress]: 0,
    [UrlStatus.Completed]: 0,
    [UrlStatus.Cancelled]: 0,
    [UrlStatus.Failed]: 0,
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
    if (url.status === UrlStatus.Pending) {
      url.status = UrlStatus.Cancelled;
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
): JobStatusType {
  if (options?.forceCancelled) {
    return JobStatus.Cancelled;
  }

  const counts = countUrlStatuses(urls);
  const total = urls.length;

  if (
    counts[UrlStatus.Cancelled] > 0 &&
    counts[UrlStatus.Pending] === 0 &&
    counts[UrlStatus.InProgress] === 0
  ) {
    return JobStatus.Cancelled;
  }

  if (total > 0 && counts[UrlStatus.Failed] === total) {
    return JobStatus.Failed;
  }

  return JobStatus.Completed;
}
