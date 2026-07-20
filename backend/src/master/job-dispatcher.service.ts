import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IJob } from '../interfaces/job.interface';
import type { IJobQueue } from '../interfaces/job-queue.interface';
import type { IJobRepository } from '../interfaces/job-repository.interface';
import type { JobStatus } from '../domain/types/job-status.type';
import type { UrlStatus } from '../domain/types/url-status.type';
import { JOB_QUEUE, JOB_REPOSITORY } from '../common/tokens';
import { WorkerPoolService } from './worker-pool.service';

interface JobCompleteResult {
  status: JobStatus;
  totalUrls?: number;
  failedUrls?: number;
  results?: Array<{
    url: string;
    status: UrlStatus;
    httpStatus?: number;
    error?: string;
  }>;
}

/**
 * Orchestrates job assignment to workers (SRP: dispatch only).
 * Depends on abstractions IJobQueue + WorkerPool (DIP).
 */
@Injectable()
export class JobDispatcherService {
  private readonly logger = new Logger(JobDispatcherService.name);
  private isProcessing = false;

  constructor(
    private readonly workerPool: WorkerPoolService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(JOB_QUEUE) private readonly queue: IJobQueue,
    @Inject(JOB_REPOSITORY) private readonly repository: IJobRepository,
  ) {
    this.eventEmitter.on('worker.ready', () => {
      void this.processQueue();
    });

    this.eventEmitter.on(
      'job.complete',
      ({ jobId, result }: { jobId: number; result?: JobCompleteResult }) => {
        void this.onJobComplete(jobId, result);
      },
    );

    this.eventEmitter.on('job.timeout', ({ jobId }: { jobId: number }) => {
      void this.onJobTimeout(jobId);
    });

    this.eventEmitter.on(
      'worker.error',
      ({ jobId, error }: { jobId: number; error?: unknown }) => {
        void this.onJobError(jobId, error);
      },
    );
  }

  async dispatchJob(job: IJob): Promise<void> {
    await this.queue.enqueue(job);
    await this.processQueue();
  }

  private async onJobComplete(
    jobId: number,
    result?: JobCompleteResult,
  ): Promise<void> {
    this.logger.log(`Job ${jobId} completed`);

    try {
      if (result?.results?.length) {
        for (const item of result.results) {
          await this.repository.updateUrlStatus(
            jobId,
            item.url,
            item.status,
            item.httpStatus,
            item.error,
          );
        }
      }

      const status = result?.status ?? 'completed';
      await this.repository.updateStatus(jobId, status);
    } catch (error) {
      this.logger.error(
        `Failed to persist completion for job ${jobId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    void this.processQueue();
  }

  private async onJobTimeout(jobId: number): Promise<void> {
    this.logger.warn(`Job ${jobId} timed out`);
    try {
      await this.repository.updateStatus(jobId, 'failed');
    } catch (error) {
      this.logger.error(
        `Failed to mark job ${jobId} timed out: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    void this.processQueue();
  }

  private async onJobError(jobId: number, error?: unknown): Promise<void> {
    this.logger.error(
      `Job ${jobId} failed on worker: ${
        error instanceof Error
          ? error.message
          : typeof error === 'object'
            ? JSON.stringify(error)
            : String(error)
      }`,
    );
    try {
      await this.repository.updateStatus(jobId, 'failed');
    } catch (err) {
      this.logger.error(
        `Failed to mark job ${jobId} as failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    if ((await this.queue.size()) === 0) {
      return;
    }
    if (this.workerPool.getAvailableWorkersCount() === 0) {
      return;
    }

    this.isProcessing = true;
    let job: IJob | null = null;

    try {
      job = await this.queue.dequeue();
      if (job) {
        await this.repository.updateStatus(job.id, 'in_progress');
        await this.workerPool.assignJob(job);
      }
    } catch (error) {
      this.logger.error(
        `Failed to dispatch job: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      if (job) {
        await this.queue.enqueue(job);
      }
    } finally {
      this.isProcessing = false;
    }

    if (
      (await this.queue.size()) > 0 &&
      this.workerPool.getAvailableWorkersCount() > 0
    ) {
      void this.processQueue();
    }
  }

  async getQueueSize(): Promise<number> {
    return this.queue.size();
  }
}
