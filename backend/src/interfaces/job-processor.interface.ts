import type { IJob } from './job.interface';

export interface IJobProcessor {
  process(job: IJob): Promise<void>;
}
