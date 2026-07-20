import { JobStatus, type JobStatus as JobStatusType } from '../types/job-status.type';
import type { JobUrlEntity } from './job-url.entity';
import type { IJob } from '../../interfaces/job.interface';

export class JobEntity implements IJob {
  constructor(
    public readonly id: number,
    public urls: JobUrlEntity[],
    public status: JobStatusType = JobStatus.Pending,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}
}
