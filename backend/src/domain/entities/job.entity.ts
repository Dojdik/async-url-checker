import type { JobStatus } from '../types/job-status.type';
import type { IJob } from '../../interfaces/job.interface';
import type { JobUrlEntity } from './job-url.entity';

export class JobEntity implements IJob {
  constructor(
    public readonly id: number,
    public urls: JobUrlEntity[],
    public status: JobStatus = 'pending',
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}
}
