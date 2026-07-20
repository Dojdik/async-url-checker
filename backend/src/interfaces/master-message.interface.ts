import type { IJob } from './job.interface';

export interface IMasterMessage {
  type: 'process_job';
  job: IJob;
}
