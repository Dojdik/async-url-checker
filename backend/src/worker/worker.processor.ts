import cluster from 'node:cluster';
import { setTimeout as delay } from 'node:timers/promises';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IHttpClient } from '../interfaces/http-client.interface';
import type { IJob } from '../interfaces/job.interface';
import type { IJobRepository } from '../interfaces/job-repository.interface';
import type { IJobUrl } from '../interfaces/job-url.interface';
import type { IMasterMessage } from '../interfaces/master-message.interface';
import type { IWorkerMessage } from '../interfaces/worker-message.interface';
import type { JobStatus } from '../domain/types/job-status.type';
import type { UrlStatus } from '../domain/types/url-status.type';
import {
  cancelPendingUrls,
  countUrlStatuses,
  resolveJobStatusFromUrls,
} from '../domain/job-rules';
import type { AppConfiguration } from '../config/configuration';
import { HTTP_CLIENT, JOB_REPOSITORY } from '../common/tokens';
import { toErrorMessage } from '../common/errors';
import { randomDelay } from '../utils';

/**
 * Worker-side job processor:
 * - HEAD each URL
 * - artificial delay before saving the result (URL_DELAY_MAX_SECONDS)
 * - limited concurrent HEAD requests per job (MAX_CONCURRENT_URLS)
 */
@Injectable()
export class WorkerProcessor implements OnModuleInit {
  private readonly logger = new Logger(WorkerProcessor.name);
  private readonly maxConcurrentUrls: number;
  private readonly urlDelayMaxSeconds: number;
  /** Jobs that received a cancel signal from the master */
  private readonly cancelledJobs = new Set<number>();

  constructor(
    @Inject(HTTP_CLIENT) private readonly httpClient: IHttpClient,
    @Inject(JOB_REPOSITORY) private readonly repository: IJobRepository,
    config: ConfigService<AppConfiguration, true>,
  ) {
    this.maxConcurrentUrls = config.get('maxConcurrentUrls', { infer: true });
    this.urlDelayMaxSeconds = config.get('urlDelayMaxSeconds', { infer: true });
  }

  onModuleInit(): void {
    process.on('message', (message: IMasterMessage) => {
      if (message?.type === 'process_job') {
        void this.processJob(message.job);
      } else if (message?.type === 'cancel_job') {
        this.cancelledJobs.add(message.jobId);
        this.logger.log(`Cancel received for job ${message.jobId}`);
      }
    });

    process.on('SIGTERM', () => {
      this.logger.log('Worker received SIGTERM');
      process.exit(0);
    });

    process.on('disconnect', () => {
      process.exit(0);
    });

    this.sendToMaster({ type: 'ready' });
  }

  private isCancelled(jobId: number): boolean {
    return this.cancelledJobs.has(jobId);
  }

  private async processJob(job: IJob): Promise<void> {
    const workerId = cluster.worker?.id;
    this.logger.log(`Worker ${workerId} processing job ${job.id}`);

    try {
      await this.repository.save(job);
      await this.repository.updateStatus(job.id, 'in_progress');

      await this.processUrlsWithConcurrency(job);

      if (this.isCancelled(job.id)) {
        cancelPendingUrls(job);
        await this.repository.cancel(job.id);
      }

      const status = this.resolveJobStatus(job);
      if (!this.isCancelled(job.id)) {
        await this.repository.updateStatus(job.id, status);
      }

      const counts = countUrlStatuses(job.urls);
      this.sendToMaster({
        type: status === 'cancelled' ? 'cancelled' : 'complete',
        jobId: job.id,
        payload: {
          status,
          totalUrls: job.urls.length,
          failedUrls: counts.failed,
          cancelledUrls: counts.cancelled,
          results: job.urls.map((u) => ({
            url: u.url,
            status: u.status,
            httpStatus: u.httpStatus,
            error: u.error,
          })),
        },
      });
    } catch (error) {
      const message = toErrorMessage(error);
      try {
        if (!this.isCancelled(job.id)) {
          await this.repository.updateStatus(job.id, 'failed');
        }
      } catch {
        // repository may not have the job yet
      }
      this.sendToMaster({
        type: 'error',
        jobId: job.id,
        payload: { error: message },
      });
    } finally {
      this.cancelledJobs.delete(job.id);
    }
  }

  /**
   * Process URLs with a limited concurrency pool.
   * New URLs are not started after cancel.
   */
  private async processUrlsWithConcurrency(job: IJob): Promise<void> {
    const urls = job.urls;
    let nextIndex = 0;
    let active = 0;

    await new Promise<void>((resolve) => {
      const pump = (): void => {
        if (this.isCancelled(job.id)) {
          if (active === 0) {
            resolve();
          }
          return;
        }

        while (active < this.maxConcurrentUrls && nextIndex < urls.length) {
          if (this.isCancelled(job.id)) {
            break;
          }

          const urlEntity = urls[nextIndex++];
          active++;

          void this.processUrl(urlEntity, job.id).finally(() => {
            active--;
            if (
              this.isCancelled(job.id) ||
              (nextIndex >= urls.length && active === 0)
            ) {
              if (active === 0) {
                resolve();
              } else if (this.isCancelled(job.id)) {
                return;
              }
            } else {
              pump();
            }
          });
        }

        if (nextIndex >= urls.length && active === 0) {
          resolve();
        }
      };

      pump();
    });
  }

  private async processUrl(urlEntity: IJobUrl, jobId: number): Promise<void> {
    const workerId = cluster.worker?.id;

    if (this.isCancelled(jobId) && urlEntity.status === 'pending') {
      await this.applyUrlState(jobId, urlEntity, { status: 'cancelled' });
      return;
    }

    try {
      await this.applyUrlState(jobId, urlEntity, { status: 'in_progress' });

      const response = await this.httpClient.head(urlEntity.url);

      const waitMs = randomDelay(this.urlDelayMaxSeconds);
      this.logger.debug(
        `Worker ${workerId}: delaying ${waitMs}ms for ${urlEntity.url}`,
      );
      await delay(waitMs);

      // URL was already started — finish even if job was cancelled mid-flight
      await this.applyUrlState(jobId, urlEntity, {
        status: 'completed',
        httpStatus: response.status,
      });

      this.logger.log(
        `Worker ${workerId}: ${urlEntity.url} -> ${response.status}`,
      );
    } catch (error) {
      const message = toErrorMessage(error);
      await this.applyUrlState(jobId, urlEntity, {
        status: 'failed',
        error: message,
      });
      this.logger.error(
        `Worker ${workerId}: ${urlEntity.url} failed: ${message}`,
      );
    }
  }

  /**
   * Single place for URL state: mutate entity, persist, notify master.
   */
  private async applyUrlState(
    jobId: number,
    urlEntity: IJobUrl,
    patch: {
      status: UrlStatus;
      httpStatus?: number;
      error?: string;
    },
  ): Promise<void> {
    const now = new Date();

    urlEntity.status = patch.status;
    if (patch.httpStatus !== undefined) {
      urlEntity.httpStatus = patch.httpStatus;
    }
    if (patch.error !== undefined) {
      urlEntity.error = patch.error;
    }
    if (patch.status === 'in_progress') {
      urlEntity.startedAt = urlEntity.startedAt ?? now;
    }
    if (
      patch.status === 'completed' ||
      patch.status === 'failed' ||
      patch.status === 'cancelled'
    ) {
      urlEntity.endedAt = now;
      if (!urlEntity.startedAt) {
        urlEntity.startedAt = now;
      }
    }

    await this.repository.updateUrlStatus(
      jobId,
      urlEntity.url,
      patch.status,
      patch.httpStatus,
      patch.error,
    );
    this.reportUrlProgress(jobId, urlEntity);
  }

  private reportUrlProgress(jobId: number, urlEntity: IJobUrl): void {
    this.sendToMaster({
      type: 'url_progress',
      jobId,
      payload: {
        url: urlEntity.url,
        status: urlEntity.status,
        httpStatus: urlEntity.httpStatus,
        error: urlEntity.error,
      },
    });
  }

  private resolveJobStatus(job: IJob): JobStatus {
    return resolveJobStatusFromUrls(job.urls, {
      forceCancelled: this.isCancelled(job.id) || job.status === 'cancelled',
    });
  }

  private sendToMaster(message: IWorkerMessage): void {
    if (typeof process.send !== 'function' || !process.connected) {
      return;
    }
    try {
      process.send(message);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EPIPE') {
        this.logger.warn(
          `Failed to send message to master: ${toErrorMessage(error)}`,
        );
      }
    }
  }
}
