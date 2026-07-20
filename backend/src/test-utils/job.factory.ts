import type { IJob } from '../interfaces/job.interface';
import type { IJobUrl } from '../interfaces/job-url.interface';
import { JobStatus, type JobStatus as JobStatusType } from '../domain/types/job-status.type';
import { UrlStatus, type UrlStatus as UrlStatusType } from '../domain/types/url-status.type';

export function makeUrl(
  url: string,
  status: UrlStatusType = UrlStatus.Pending,
  extra: Partial<IJobUrl> = {},
): IJobUrl {
  return {
    url,
    status,
    ...extra,
  };
}

export function makeJob(
  overrides: Partial<IJob> & { urls?: IJobUrl[] } = {},
): IJob {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: overrides.id ?? 1,
    status: overrides.status ?? JobStatus.Pending,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    urls:
      overrides.urls ??
      [makeUrl('https://example.com'), makeUrl('https://example.org')],
  };
}

export { JobStatus, UrlStatus };
