import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import type { IJob } from '../interfaces/job.interface';
import type { IJobFactory } from '../interfaces/job-factory.interface';
import type { IJobRepository } from '../interfaces/job-repository.interface';
import { JOB_FACTORY, JOB_REPOSITORY } from '../common/tokens';
import { JobDispatcherService } from '../master/job-dispatcher.service';
import type { JobListItemDto, JobUrlStatsDto } from './dto/job-list-item.dto';
import type {
  ApiUrlStatus,
  JobDetailDto,
  JobUrlDetailDto,
} from './dto/job-detail.dto';
import type { IJobUrl } from '../interfaces/job-url.interface';
import type { UrlStatus } from '../domain/types/url-status.type';

@Injectable()
export class JobService {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly repository: IJobRepository,
    @Inject(JOB_FACTORY) private readonly factory: IJobFactory,
    @Inject(forwardRef(() => JobDispatcherService))
    private readonly dispatcher: JobDispatcherService,
  ) {}

  async create(
    urls: string[],
  ): Promise<Pick<IJob, 'id' | 'status' | 'createdAt'>> {
    if (!urls?.length) {
      throw new BadRequestException('urls must not be empty');
    }

    const job = this.factory.create(urls);
    await this.repository.save(job);
    await this.dispatcher.dispatchJob(job);

    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
    };
  }

  /**
   * GET /api/jobs — brief list: id, createdAt, status, url count, success/error stats.
   */
  async findAll(offset: number, count: number): Promise<JobListItemDto[]> {
    const jobs = await this.repository.findAll(offset, count);
    return jobs.map((job) => this.toListItem(job));
  }

  private toListItem(job: IJob): JobListItemDto {
    return {
      id: job.id,
      createdAt: job.createdAt,
      status: job.status,
      urlsCount: job.urls.length,
      stats: this.buildUrlStats(job),
    };
  }

  private buildUrlStats(job: IJob): JobUrlStatsDto {
    const stats: JobUrlStatsDto = {
      succeeded: 0,
      failed: 0,
      pending: 0,
      in_progress: 0,
      cancelled: 0,
    };

    for (const url of job.urls) {
      switch (url.status) {
        case 'completed':
          stats.succeeded += 1;
          break;
        case 'failed':
          stats.failed += 1;
          break;
        case 'pending':
          stats.pending += 1;
          break;
        case 'in_progress':
          stats.in_progress += 1;
          break;
        case 'cancelled':
          stats.cancelled += 1;
          break;
      }
    }

    return stats;
  }

  /**
   * GET /api/jobs/:id — detailed job with per-URL status, HTTP code, error, timings.
   */
  async find(id: number): Promise<JobDetailDto> {
    const job = await this.repository.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return this.toDetail(job);
  }

  private toDetail(job: IJob): JobDetailDto {
    return {
      id: job.id,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      status: job.status,
      urls: job.urls.map((url) => this.toUrlDetail(url)),
    };
  }

  private toUrlDetail(url: IJobUrl): JobUrlDetailDto {
    const startedAt = url.startedAt;
    const endedAt = url.endedAt;
    const durationMs =
      startedAt && endedAt
        ? Math.max(0, endedAt.getTime() - startedAt.getTime())
        : undefined;

    return {
      url: url.url,
      status: this.toApiUrlStatus(url.status),
      httpStatus: url.httpStatus,
      error: url.error,
      startedAt,
      endedAt,
      durationMs,
    };
  }

  private toApiUrlStatus(status: UrlStatus): ApiUrlStatus {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return status;
    }
  }

  /**
   * DELETE /api/jobs/:id — mark cancelled and stop not-started URLs.
   */
  async cancel(id: number): Promise<IJob> {
    const job = await this.repository.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (
      job.status === 'completed' ||
      job.status === 'failed' ||
      job.status === 'cancelled'
    ) {
      throw new ConflictException(
        `Job cannot be cancelled in status "${job.status}"`,
      );
    }

    return this.dispatcher.cancelJob(id);
  }
}
