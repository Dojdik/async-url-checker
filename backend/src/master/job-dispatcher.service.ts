import { IJob } from '@/interfaces/job.interface';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkerPoolService } from './worker-pool.service';

@Injectable()
export class JobDispatcherService {
  private queue: IJob[] = [];
  private isProcessing = false;

  constructor(
    private readonly workerPool: WorkerPoolService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Слушаем события от воркеров
    this.eventEmitter.on('worker.ready', () => {
      this.processQueue();
    });

    this.eventEmitter.on('job.complete', ({ jobId, result }) => {
      console.log(`Job ${jobId} completed:`, result);
      this.processQueue();
    });

    this.eventEmitter.on('job.timeout', ({ jobId }) => {
      console.log(`Job ${jobId} timed out`);
      this.processQueue();
    });
  }

  async dispatchJob(job: IJob): Promise<void> {
    this.queue.push(job);
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;
    if (this.workerPool.getAvailableWorkersCount() === 0) return;

    this.isProcessing = true;
    let job: IJob | undefined;
    try {
      job = this.queue.shift();
      if (job) {
        await this.workerPool.assignJob(job);
      }
    } catch (error) {
      console.error('Failed to dispatch job:', error);
      // Возвращаем задачу обратно в очередь
      if (job) {
        this.queue.unshift(job);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}