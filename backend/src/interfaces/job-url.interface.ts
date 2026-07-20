import type { UrlStatus } from '../domain/types/url-status.type';

export interface IJobUrl {
  url: string;
  status: UrlStatus;
  httpStatus?: number;
  error?: string;
  /** Set when processing actually starts (in_progress). */
  startedAt?: Date;
  /** Set when processing finishes (success/error/cancelled). */
  endedAt?: Date;
}
