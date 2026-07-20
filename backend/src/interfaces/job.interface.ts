import type { JobStatus } from '../domain/types/job-status.type';
import type { IJobUrl } from './job-url.interface';

export interface IJob {
  id: number;
  urls: IJobUrl[];
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}
