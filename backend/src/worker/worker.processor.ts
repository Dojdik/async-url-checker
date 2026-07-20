import cluster from 'node:cluster';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { IHttpClient } from '../interfaces/http-client.interface';
import type { IJob } from '../interfaces/job.interface';
import type { IJobRepository } from '../interfaces/job-repository.interface';
import type { IJobUrl } from '../interfaces/job-url.interface';
import type { IMasterMessage } from '../interfaces/master-message.interface';
import type { IWorkerMessage } from '../interfaces/worker-message.interface';
import { HTTP_CLIENT, JOB_REPOSITORY } from '../common/tokens';

/**
 * Worker-side job processor: receives jobs via IPC and checks URLs (SRP).
 */
@Injectable()
export class WorkerProcessor implements OnModuleInit {
  private readonly logger = new Logger(WorkerProcessor.name);
  private readonly maxConcurrentUrls = 5;

  constructor(
    @Inject(HTTP_CLIENT) private readonly httpClient: IHttpClient,
    @Inject(JOB_REPOSITORY) private readonly repository: IJobRepository,
  ) {}

  onModuleInit(): void {
    process.on('message', (message: IMasterMessage) => {
      if (message?.type === 'process_job') {
        void this.processJob(message.job);
      }
    });

    process.on('SIGTERM', () => {
      this.logger.log('Worker received SIGTERM');
      process.exit(0);
    });

    // Master restarts (e.g. nest --watch) disconnect IPC — exit cleanly
    process.on('disconnect', () => {
      process.exit(0);
    });

    this.sendToMaster({ type: 'ready' });
  }

  private async processJob(job: IJob): Promise<void> {
    const workerId = cluster.worker?.id;
    this.logger.log(`Worker ${workerId} processing job ${job.id}`);

    try {
      await this.repository.save(job);
      await this.repository.updateStatus(job.id, 'in_progress');

      const chunks = this.chunkArray(job.urls, this.maxConcurrentUrls);

      for (const chunk of chunks) {
        await Promise.allSettled(
          chunk.map((url) => this.processUrl(url, job.id)),
        );
      }

      const failedUrls = job.urls.filter((u) => u.status === 'failed');
      const status =
        failedUrls.length === job.urls.length ? 'failed' : 'completed';

      await this.repository.updateStatus(job.id, status);

      this.sendToMaster({
        type: 'complete',
        jobId: job.id,
        payload: {
          status,
          totalUrls: job.urls.length,
          failedUrls: failedUrls.length,
          results: job.urls.map((u) => ({
            url: u.url,
            status: u.status,
            httpStatus: u.httpStatus,
            error: u.error,
          })),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await this.repository.updateStatus(job.id, 'failed');
      } catch {
        // repository may not have the job yet
      }
      this.sendToMaster({
        type: 'error',
        jobId: job.id,
        payload: { error: message },
      });
    }
  }

  private async processUrl(urlEntity: IJobUrl, jobId: number): Promise<void> {
    const workerId = cluster.worker?.id;

    try {
      urlEntity.status = 'in_progress';
      await this.repository.updateUrlStatus(jobId, urlEntity.url, 'in_progress');

      const response = await this.httpClient.head(urlEntity.url);

      urlEntity.status = 'completed';
      urlEntity.httpStatus = response.status;
      urlEntity.endedAt = new Date();

      await this.repository.updateUrlStatus(
        jobId,
        urlEntity.url,
        'completed',
        response.status,
      );

      this.logger.log(
        `Worker ${workerId}: ${urlEntity.url} -> ${response.status}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      urlEntity.status = 'failed';
      urlEntity.error = message;
      urlEntity.endedAt = new Date();

      await this.repository.updateUrlStatus(
        jobId,
        urlEntity.url,
        'failed',
        undefined,
        message,
      );

      this.logger.error(`Worker ${workerId}: ${urlEntity.url} failed: ${message}`);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sendToMaster(message: IWorkerMessage): void {
    if (typeof process.send !== 'function' || !process.connected) {
      return;
    }
    try {
      process.send(message);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      // EPIPE when master already exited (common under nest --watch reloads)
      if (err.code !== 'EPIPE') {
        this.logger.warn(`Failed to send message to master: ${err.message}`);
      }
    }
  }
}

