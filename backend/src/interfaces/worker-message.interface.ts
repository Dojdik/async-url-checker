import type { UrlStatus } from '../domain/types/url-status.type';

export interface IWorkerMessage {
  type: 'ready' | 'complete' | 'error' | 'cancelled' | 'url_progress' | 'job_done';
  payload?: unknown;
  jobId?: number;
}

export interface IUrlProgressPayload {
  url: string;
  status: UrlStatus;
  httpStatus?: number;
  error?: string;
}
