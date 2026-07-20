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

  async remove(jobId: number): Promise<IJob | null> {
    const index = this.queue.findIndex((job) => job.id === jobId);
    if (index === -1) {
      return null;
    }
    const [removed] = this.queue.splice(index, 1);
    return removed ?? null;
  }

  async size(): Promise<number> {
    return this.queue.length;
  }

  async isEmpty(): Promise<boolean> {
    return this.queue.length === 0;
  }
}
