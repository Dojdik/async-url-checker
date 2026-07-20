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

  async findAll(offset: number, count: number) {
    const jobs = await this.repository.findAll(offset, count);
    return jobs.map((job) => ({
      id: job.id,
      createdAt: job.createdAt,
      status: job.status,
    }));
  }

  async find(id: number): Promise<IJob> {
    const job = await this.repository.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
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
