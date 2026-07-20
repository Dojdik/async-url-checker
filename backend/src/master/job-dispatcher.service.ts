import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IJob } from '../interfaces/job.interface';
import type { IJobQueue } from '../interfaces/job-queue.interface';
import type { IJobRepository } from '../interfaces/job-repository.interface';
import type { JobStatus } from '../domain/types/job-status.type';
import type { UrlStatus } from '../domain/types/url-status.type';
import type { IUrlProgressPayload } from '../interfaces/worker-message.interface';
import { JOB_QUEUE, JOB_REPOSITORY } from '../common/tokens';
import { toErrorMessage } from '../common/errors';
import { WorkerPoolService } from './worker-pool.service';

interface JobUrlResult {
  url: string;
  status: UrlStatus;
  httpStatus?: number;
  error?: string;
}

interface JobCompleteResult {
  status: JobStatus;
  totalUrls?: number;
  failedUrls?: number;
  cancelledUrls?: number;
  results?: JobUrlResult[];
}

/**
 * Orchestrates job assignment to workers (SRP: dispatch only).
 * Supports concurrent jobs up to the number of available workers.
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
      'job.url_progress',
      ({
        jobId,
        progress,
      }: {
        jobId: number;
        progress?: IUrlProgressPayload;
      }) => {
        void this.onUrlProgress(jobId, progress);
      },
    );

    this.eventEmitter.on(
      'job.complete',
      ({ jobId, result }: { jobId: number; result?: JobCompleteResult }) => {
        void this.onJobComplete(jobId, result);
      },
    );

    this.eventEmitter.on('job.timeout', ({ jobId }: { jobId: number }) => {
      void this.failJobUnlessCancelled(jobId, `Job ${jobId} timed out`);
    });

    this.eventEmitter.on(
      'worker.error',
      ({ jobId, error }: { jobId: number; error?: unknown }) => {
        void this.failJobUnlessCancelled(
          jobId,
          `Job ${jobId} failed on worker: ${toErrorMessage(error)}`,
        );
      },
    );
  }

  async dispatchJob(job: IJob): Promise<void> {
    await this.queue.enqueue(job);
    await this.processQueue();
  }

  /**
   * Cancel a job: remove from queue if waiting, notify worker if running,
   * mark job + pending URLs as cancelled.
   */
  async cancelJob(jobId: number): Promise<IJob> {
    await this.queue.remove(jobId);
    this.workerPool.cancelJob(jobId);

    const cancelled = await this.repository.cancel(jobId);
    if (!cancelled) {
      throw new Error(`Job ${jobId} not found`);
    }

    this.logger.log(`Job ${jobId} cancelled`);
    void this.processQueue();
    return cancelled;
  }

  private async onUrlProgress(
    jobId: number,
    progress?: IUrlProgressPayload,
  ): Promise<void> {
    if (!progress?.url) {
      return;
    }
    try {
      await this.repository.updateUrlStatus(
        jobId,
        progress.url,
        progress.status,
        progress.httpStatus,
        progress.error,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to apply URL progress for job ${jobId}: ${toErrorMessage(error)}`,
      );
    }
  }

  private async onJobComplete(
    jobId: number,
    result?: JobCompleteResult,
  ): Promise<void> {
    this.logger.log(
      `Job ${jobId} finished with status ${result?.status ?? 'completed'}`,
    );

    try {
      const existing = await this.repository.findById(jobId);
      const alreadyCancelled = existing?.status === 'cancelled';

      await this.applyUrlResults(jobId, result?.results, {
        onlyFinished: alreadyCancelled,
      });

      if (!alreadyCancelled) {
        await this.repository.updateStatus(
          jobId,
          result?.status ?? 'completed',
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to persist completion for job ${jobId}: ${toErrorMessage(error)}`,
      );
    }

    void this.processQueue();
  }

  /**
   * Apply worker URL results onto the master repository.
   * When onlyFinished is true (job already cancelled), keep pending/cancelled
   * master state and only merge URLs that actually completed or failed.
   */
  private async applyUrlResults(
    jobId: number,
    results: JobUrlResult[] | undefined,
    options: { onlyFinished: boolean },
  ): Promise<void> {
    if (!results?.length) {
      return;
    }

    for (const item of results) {
      if (
        options.onlyFinished &&
        item.status !== 'completed' &&
        item.status !== 'failed'
      ) {
        continue;
      }
      await this.repository.updateUrlStatus(
        jobId,
        item.url,
        item.status,
        item.httpStatus,
        item.error,
      );
    }
  }

  private async failJobUnlessCancelled(
    jobId: number,
    logMessage: string,
  ): Promise<void> {
    this.logger.warn(logMessage);
    try {
      const job = await this.repository.findById(jobId);
      if (job?.status !== 'cancelled') {
        await this.repository.updateStatus(jobId, 'failed');
      }
    } catch (error) {
      this.logger.error(
        `Failed to mark job ${jobId} as failed: ${toErrorMessage(error)}`,
      );
    }
    void this.processQueue();
  }

  /**
   * Dispatch as many queued jobs as there are free workers (multi-job concurrency).
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (
        (await this.queue.size()) > 0 &&
        this.workerPool.getAvailableWorkersCount() > 0
      ) {
        const job = await this.queue.dequeue();
        if (!job) {
          break;
        }

        const current = await this.repository.findById(job.id);
        if (!current || current.status === 'cancelled') {
          continue;
        }

        try {
          await this.repository.updateStatus(job.id, 'in_progress');
          await this.workerPool.assignJob(job);
        } catch (error) {
          this.logger.error(
            `Failed to dispatch job ${job.id}: ${toErrorMessage(error)}`,
          );
          await this.queue.enqueue(job);
          break;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async getQueueSize(): Promise<number> {
    return this.queue.size();
  }
}
