import cluster from 'node:cluster';
import { setTimeout as delay } from 'node:timers/promises';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IHttpClient } from '../interfaces/http-client.interface';
import type { IJob } from '../interfaces/job.interface';
import type { IJobRepository } from '../interfaces/job-repository.interface';
import type { IJobUrl } from '../interfaces/job-url.interface';
import {
  MasterMessageType,
  type IMasterMessage,
} from '../interfaces/master-message.interface';
import {
  WorkerMessageType,
  type IWorkerMessage,
} from '../interfaces/worker-message.interface';
import { JobStatus, type JobStatus as JobStatusType } from '../domain/types/job-status.type';
import { UrlStatus, type UrlStatus as UrlStatusType } from '../domain/types/url-status.type';
import {
  cancelPendingUrls,
  countUrlStatuses,
  resolveJobStatusFromUrls,
} from '../domain/job-rules';
import type { AppConfiguration } from '../config/configuration';
import { HTTP_CLIENT, JOB_REPOSITORY } from '../common/tokens';
import { toErrorMessage } from '../common/errors';
import { deserializeJobFromIpc, isMasterMessage } from '../common/job-ipc';
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
    process.on('message', (raw: unknown) => {
      if (!isMasterMessage(raw)) {
        this.logger.warn('Ignoring invalid master IPC message');
        return;
      }

      if (raw.type === MasterMessageType.ProcessJob) {
        try {
          const job = deserializeJobFromIpc(
            (raw as Extract<
              IMasterMessage,
              { type: typeof MasterMessageType.ProcessJob }
            >).job,
          );
          void this.processJob(job);
        } catch (error) {
          this.logger.error(
            `Failed to deserialize process_job: ${toErrorMessage(error)}`,
          );
        }
        return;
      }

      if (raw.type === MasterMessageType.CancelJob) {
        const jobId = (
          raw as Extract<
            IMasterMessage,
            { type: typeof MasterMessageType.CancelJob }
          >
        ).jobId;
        if (typeof jobId === 'number') {
          this.cancelledJobs.add(jobId);
          this.logger.log(`Cancel received for job ${jobId}`);
        }
      }
    });

    process.on('SIGTERM', () => {
      this.logger.log('Worker received SIGTERM');
      process.exit(0);
    });

    process.on('disconnect', () => {
      process.exit(0);
    });

    this.sendToMaster({ type: WorkerMessageType.Ready });
  }

  private isCancelled(jobId: number): boolean {
    return this.cancelledJobs.has(jobId);
  }

  private async processJob(job: IJob): Promise<void> {
    const workerId = cluster.worker?.id;
    this.logger.log(`Worker ${workerId} processing job ${job.id}`);

    try {
      await this.repository.save(job);
      await this.repository.updateStatus(job.id, JobStatus.InProgress);

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
        type:
          status === JobStatus.Cancelled
            ? WorkerMessageType.Cancelled
            : WorkerMessageType.Complete,
        jobId: job.id,
        payload: {
          status,
          totalUrls: job.urls.length,
          failedUrls: counts[UrlStatus.Failed],
          cancelledUrls: counts[UrlStatus.Cancelled],
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
          await this.repository.updateStatus(job.id, JobStatus.Failed);
        }
      } catch {
        // repository may not have the job yet
      }
      this.sendToMaster({
        type: WorkerMessageType.Error,
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

    if (this.isCancelled(jobId) && urlEntity.status === UrlStatus.Pending) {
      await this.applyUrlState(jobId, urlEntity, { status: UrlStatus.Cancelled });
      return;
    }

    try {
      await this.applyUrlState(jobId, urlEntity, {
        status: UrlStatus.InProgress,
      });

      const response = await this.httpClient.head(urlEntity.url);

      const waitMs = randomDelay(this.urlDelayMaxSeconds);
      this.logger.debug(
        `Worker ${workerId}: delaying ${waitMs}ms for ${urlEntity.url}`,
      );
      await delay(waitMs);

      // URL was already started — finish even if job was cancelled mid-flight
      await this.applyUrlState(jobId, urlEntity, {
        status: UrlStatus.Completed,
        httpStatus: response.status,
      });

      this.logger.log(
        `Worker ${workerId}: ${urlEntity.url} -> ${response.status}`,
      );
    } catch (error) {
      const message = toErrorMessage(error);
      await this.applyUrlState(jobId, urlEntity, {
        status: UrlStatus.Failed,
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
      status: UrlStatusType;
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
    if (patch.status === UrlStatus.InProgress) {
      urlEntity.startedAt = urlEntity.startedAt ?? now;
    }
    if (
      patch.status === UrlStatus.Completed ||
      patch.status === UrlStatus.Failed ||
      patch.status === UrlStatus.Cancelled
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
      type: WorkerMessageType.UrlProgress,
      jobId,
      payload: {
        url: urlEntity.url,
        status: urlEntity.status,
        httpStatus: urlEntity.httpStatus,
        error: urlEntity.error,
      },
    });
  }

  private resolveJobStatus(job: IJob): JobStatusType {
    return resolveJobStatusFromUrls(job.urls, {
      forceCancelled:
        this.isCancelled(job.id) || job.status === JobStatus.Cancelled,
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
