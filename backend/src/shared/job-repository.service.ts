import { IJob } from '@/common/interfaces/job.interface';
import { UrlStatus } from '@/entities/job-url.entity';
import { IJobRepository } from '@/interfaces/job.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JobRepositoryService implements IJobRepository {
  private jobs: Map<number, IJob> = new Map();
  
  async save(job: IJob): Promise<void> {
    this.jobs.set(job.id, job);
  }
  
  async findById(id: number): Promise<IJob | null> {
    return this.jobs.get(id) || null;
  }
  
  async updateStatus(id: number, status: JobStatus): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Job ${id} not found`);
    job.status = status;
    job.updatedAt = new Date();
  }
  
  async updateUrlStatus(url: string, status: UrlStatus, httpStatus?: number, error?: string): Promise<void> {
    for (const [_, job] of this.jobs) {
      const urlEntity = job.urls.find(u => u.url === url);
      if (urlEntity) {
        urlEntity.status = status;
        if (httpStatus !== undefined) urlEntity.httpStatus = httpStatus;
        if (error) urlEntity.error = error;
        if (status === 'completed' || status === 'failed') {
          urlEntity.endedAt = new Date();
        }
        break;
      }
    }
  }
}