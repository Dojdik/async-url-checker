import type { IJob } from './job.interface';

export type IMasterMessage =
  | {
      type: 'process_job';
      job: IJob;
    }
  | {
      type: 'cancel_job';
      jobId: number;
    };
