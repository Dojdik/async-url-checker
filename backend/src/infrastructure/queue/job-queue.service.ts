import { Injectable } from '@nestjs/common';
import type { IJob } from '../../interfaces/job.interface';
import type { IJobQueue } from '../../interfaces/job-queue.interface';

/** In-memory FIFO queue — only queueing concerns (SRP). */
@Injectable()
export class JobQueueService implements IJobQueue {
  private readonly queue: IJob[] = [];

  async enqueue(job: IJob): Promise<void> {
    this.queue.push(job);
  }

  async dequeue(): Promise<IJob | null> {
    return this.queue.shift() ?? null;
  }

  async size(): Promise<number> {
    return this.queue.length;
  }

  async isEmpty(): Promise<boolean> {
    return this.queue.length === 0;
  }
}
