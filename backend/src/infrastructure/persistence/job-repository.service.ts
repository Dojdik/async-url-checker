import { Injectable, NotFoundException } from '@nestjs/common';
import { cancelPendingUrls } from '../../domain/job-rules';
import type { JobStatus } from '../../domain/types/job-status.type';
import {
  isTerminalUrlStatus,
  type UrlStatus,
} from '../../domain/types/url-status.type';
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
    const job = this.requireJob(id);
    // Do not overwrite terminal cancelled state with later worker results
    if (job.status === 'cancelled' && status !== 'cancelled') {
      return;
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
    const job = this.requireJob(jobId);
    const urlEntity = job.urls.find((u) => u.url === url);
    if (!urlEntity) {
      throw new NotFoundException(`URL ${url} not found in job ${jobId}`);
    }

    // pending must not revive a cancelled URL; completed/failed/in_progress may
    if (urlEntity.status === 'cancelled' && status === 'pending') {
      return;
    }

    urlEntity.status = status;
    if (httpStatus !== undefined) {
      urlEntity.httpStatus = httpStatus;
    }
    if (error !== undefined) {
      urlEntity.error = error;
    }
    if (status === 'in_progress' && !urlEntity.startedAt) {
      urlEntity.startedAt = new Date();
    }
    if (isTerminalUrlStatus(status)) {
      urlEntity.endedAt = urlEntity.endedAt ?? new Date();
    }
    job.updatedAt = new Date();
  }

  async cancel(id: number): Promise<IJob | null> {
    const job = this.jobs.get(id);
    if (!job) {
      return null;
    }

    job.status = 'cancelled';
    job.updatedAt = new Date();
    cancelPendingUrls(job);
    return job;
  }

  async delete(id: number): Promise<boolean> {
    return this.jobs.delete(id);
  }

  private requireJob(id: number): IJob {
    const job = this.jobs.get(id);
    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return job;
  }
}
