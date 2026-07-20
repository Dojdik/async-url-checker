import type { JobStatus } from '../domain/types/job-status.type';
import type { UrlStatus } from '../domain/types/url-status.type';
import type { IJob } from './job.interface';

export interface IJobRepository {
  save(job: IJob): Promise<void>;
  findById(id: number): Promise<IJob | null>;
  findAll(offset: number, limit: number): Promise<IJob[]>;
  updateStatus(id: number, status: JobStatus): Promise<void>;
  updateUrlStatus(
    jobId: number,
    url: string,
    status: UrlStatus,
    httpStatus?: number,
    error?: string,
  ): Promise<void>;
  delete(id: number): Promise<boolean>;
}
