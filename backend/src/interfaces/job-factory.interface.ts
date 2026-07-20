import type { IJob } from './job.interface';
import type { IJobUrl } from './job-url.interface';

export interface IJobFactory {
  create(urls: string[]): IJob;
  createUrl(url: string): IJobUrl;
}
