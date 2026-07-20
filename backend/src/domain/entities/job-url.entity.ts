import { UrlStatus, type UrlStatus as UrlStatusType } from '../types/url-status.type';
import type { IJobUrl } from '../../interfaces/job-url.interface';

export class JobUrlEntity implements IJobUrl {
  constructor(
    public readonly url: string,
    public status: UrlStatusType = UrlStatus.Pending,
    public httpStatus?: number,
    public error?: string,
    public startedAt?: Date,
    public endedAt?: Date,
  ) {}
}
