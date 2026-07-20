import type { JobStatus } from '../domain/types/job-status.type';
import type { UrlStatus } from '../domain/types/url-status.type';
import type { IJob } from '../interfaces/job.interface';
import type { IJobUrl } from '../interfaces/job-url.interface';
import { JOB_STATUSES } from '../domain/types/job-status.type';
import { URL_STATUSES } from '../domain/types/url-status.type';

/**
 * Wire format for jobs over cluster IPC (JSON-safe).
 * Dates are ISO strings — Node cluster serializes messages as structured clone/JSON.
 */
export interface JobUrlIpcDto {
  url: string;
  status: UrlStatus;
  httpStatus?: number;
  error?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface JobIpcDto {
  id: number;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  urls: JobUrlIpcDto[];
}

function isJobStatus(value: unknown): value is JobStatus {
  return (
    typeof value === 'string' &&
    (JOB_STATUSES as readonly string[]).includes(value)
  );
}

function isUrlStatus(value: unknown): value is UrlStatus {
  return (
    typeof value === 'string' &&
    (URL_STATUSES as readonly string[]).includes(value)
  );
}

function toIso(value: Date | string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/** Master → wire: plain JSON-safe job payload. */
export function serializeJobForIpc(job: IJob): JobIpcDto {
  return {
    id: job.id,
    status: job.status,
    createdAt: toIso(job.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(job.updatedAt) ?? new Date().toISOString(),
    urls: job.urls.map((u) => ({
      url: u.url,
      status: u.status,
      httpStatus: u.httpStatus,
      error: u.error,
      startedAt: toIso(u.startedAt),
      endedAt: toIso(u.endedAt),
    })),
  };
}

/**
 * Worker ← wire: validate shape and revive Date fields.
 * Throws if payload is not a valid job DTO.
 */
export function deserializeJobFromIpc(raw: unknown): IJob {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('Invalid job IPC payload: expected object');
  }

  const data = raw as Record<string, unknown>;

  if (typeof data.id !== 'number' || !Number.isFinite(data.id)) {
    throw new TypeError('Invalid job IPC payload: id');
  }
  if (!isJobStatus(data.status)) {
    throw new TypeError('Invalid job IPC payload: status');
  }
  if (!Array.isArray(data.urls)) {
    throw new TypeError('Invalid job IPC payload: urls');
  }

  const createdAt = parseDate(data.createdAt) ?? new Date();
  const updatedAt = parseDate(data.updatedAt) ?? createdAt;

  const urls: IJobUrl[] = data.urls.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new TypeError(`Invalid job IPC payload: urls[${index}]`);
    }
    const u = item as Record<string, unknown>;
    if (typeof u.url !== 'string' || !u.url) {
      throw new TypeError(`Invalid job IPC payload: urls[${index}].url`);
    }
    if (!isUrlStatus(u.status)) {
      throw new TypeError(`Invalid job IPC payload: urls[${index}].status`);
    }
    return {
      url: u.url,
      status: u.status,
      httpStatus:
        typeof u.httpStatus === 'number' ? u.httpStatus : undefined,
      error: typeof u.error === 'string' ? u.error : undefined,
      startedAt: parseDate(u.startedAt),
      endedAt: parseDate(u.endedAt),
    };
  });

  return {
    id: data.id,
    status: data.status,
    createdAt,
    updatedAt,
    urls,
  };
}

/** Type guard for master → worker messages after IPC. */
export function isMasterMessage(raw: unknown): raw is {
  type: string;
  job?: unknown;
  jobId?: number;
} {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    typeof (raw as { type?: unknown }).type === 'string'
  );
}
