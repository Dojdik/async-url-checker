import type { UrlStatus } from '../domain/types/url-status.type';

export interface IJobUrl {
  url: string;
  status: UrlStatus;
  httpStatus?: number;
  error?: string;
  startedAt: Date;
  endedAt?: Date;
}
