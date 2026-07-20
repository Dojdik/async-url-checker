import cluster from 'cluster';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IWorkerMessage } from '@/common/interfaces/message.interface';
import type { IHttpClient, IJob, IJobRepository, IJobUrl } from '@/interfaces/job.interface';
import { IMasterMessage } from '@/interfaces/message.interface';

@Injectable()
export class WorkerProcessor implements OnModuleInit {
  private currentJob: IJob | null = null;
  private processingUrls = 0;
  private readonly MAX_CONCURRENT_URLS = 5;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject('IHttpClient') private readonly httpClient: IHttpClient,
    @Inject('IJobRepository') private readonly repository: IJobRepository,
  ) {}

  onModuleInit() {
    // Сообщаем мастеру, что воркер готов
    this.sendToMaster({ type: 'ready' });

    // Слушаем сообщения от мастера
    process.on('message', (message: IMasterMessage) => {
      if (message.type === 'process_job') {
        this.processJob(message.job);
      }
    });

    // Обработка завершения
    process.on('SIGTERM', () => {
      console.log('Worker received SIGTERM');
      process.exit(0);
    });
  }

  private async processJob(job: IJob): Promise<void> {
    this.currentJob = job;
    console.log(`Worker ${cluster.worker?.id} processing job ${job.id}`);

    try {
      await this.repository.updateStatus(job.id, 'in_progress');

      // Обрабатываем URL параллельно с ограничением
      const chunks = this.chunkArray(job.urls, this.MAX_CONCURRENT_URLS);
      
      for (const chunk of chunks) {
        const promises = chunk.map(url => this.processUrl(url, job.id));
        await Promise.allSettled(promises);
      }

      // Проверяем, все ли URL обработаны
      const allCompleted = job.urls.every(u => 
        u.status === 'completed' || u.status === 'failed'
      );

      if (allCompleted) {
        const failedUrls = job.urls.filter(u => u.status === 'failed');
        const status = failedUrls.length === job.urls.length ? 'failed' : 'completed';
        
        await this.repository.updateStatus(job.id, status);
        this.sendToMaster({
          type: 'complete',
          jobId: job.id,
          payload: {
            status,
            totalUrls: job.urls.length,
            failedUrls: failedUrls.length,
            results: job.urls.map(u => ({
              url: u.url,
              status: u.status,
              httpStatus: u.httpStatus,
              error: u.error,
            })),
          },
        });
      }
    } catch (error) {
      await this.repository.updateStatus(job.id, 'failed');
      this.sendToMaster({
        type: 'error',
        jobId: job.id,
        payload: { error: (error as Error).message },
      });
    }

    this.currentJob = null;
  }

  private async processUrl(urlEntity: IJobUrl, jobId: number): Promise<void> {
    try {
      urlEntity.status = 'in_progress';
      await this.repository.updateUrlStatus(urlEntity.url, 'in_progress');

      const response = await this.httpClient.head(urlEntity.url);

      urlEntity.status = 'completed';
      urlEntity.httpStatus = response.status;
      urlEntity.endedAt = new Date();

      await this.repository.updateUrlStatus(
        urlEntity.url,
        'completed',
        response.status
      );

      console.log(`Worker ${cluster.worker?.id}: ${urlEntity.url} -> ${response.status}`);
    } catch (error) {
      urlEntity.status = 'failed';
      urlEntity.error = error.message;
      urlEntity.endedAt = new Date();

      await this.repository.updateUrlStatus(
        urlEntity.url,
        'failed',
        undefined,
        error.message
      );

      console.error(`Worker ${cluster.worker?.id}: ${urlEntity.url} failed`, error.message);
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
    if (process.send) {
      process.send(message);
    }
  }
}