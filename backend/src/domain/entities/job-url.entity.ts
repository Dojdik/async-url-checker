import type { UrlStatus } from '../types/url-status.type';
import type { IJobUrl } from '../../interfaces/job-url.interface';

export class JobUrlEntity implements IJobUrl {
  constructor(
    public readonly url: string,
    public status: UrlStatus = 'pending',
    public httpStatus?: number,
    public error?: string,
    public startedAt: Date = new Date(),
    public endedAt?: Date,
  ) {}
}
