import { Injectable, NotFoundException } from '@nestjs/common';
import type { JobStatus } from '../../domain/types/job-status.type';
import type { UrlStatus } from '../../domain/types/url-status.type';
import type { IJob } from '../../interfaces/job.interface';
import type { IJobRepository } from '../../interfaces/job-repository.interface';

@Injectable()
export class JobRepositoryService implements IJobRepository {
  private readonly jobs = new Map<number, IJob>();

  async save(job: IJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async findById(id: number): Promise<IJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async findAll(offset: number, limit: number): Promise<IJob[]> {
    const all = Array.from(this.jobs.values()).sort((a, b) => a.id - b.id);
    return all.slice(offset, offset + limit);
  }

  async updateStatus(id: number, status: JobStatus): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    job.status = status;
    job.updatedAt = new Date();
  }

  async updateUrlStatus(
    jobId: number,
    url: string,
    status: UrlStatus,
    httpStatus?: number,
    error?: string,
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const urlEntity = job.urls.find((u) => u.url === url);
    if (!urlEntity) {
      throw new NotFoundException(`URL ${url} not found in job ${jobId}`);
    }

    urlEntity.status = status;
    if (httpStatus !== undefined) {
      urlEntity.httpStatus = httpStatus;
    }
    if (error !== undefined) {
      urlEntity.error = error;
    }
    if (status === 'completed' || status === 'failed') {
      urlEntity.endedAt = new Date();
    }
    job.updatedAt = new Date();
  }

  async delete(id: number): Promise<boolean> {
    return this.jobs.delete(id);
  }
}
