import type { IJob } from './job.interface';

export interface IJobQueue {
  enqueue(job: IJob): Promise<void>;
  dequeue(): Promise<IJob | null>;
  remove(jobId: number): Promise<IJob | null>;
  size(): Promise<number>;
  isEmpty(): Promise<boolean>;
}
