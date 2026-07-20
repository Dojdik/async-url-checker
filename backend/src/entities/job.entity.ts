import { JobUrlEntity } from "./job-url.entity";

export class JobEntity {
  constructor(
    public readonly id: number,
    public urls: JobUrlEntity[],
    public status: JobStatus = 'pending',
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}
}

export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';