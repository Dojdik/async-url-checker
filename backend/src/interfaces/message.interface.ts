import { IJob } from "./job.interface";

export interface IWorkerMessage {
  type: 'ready' | 'complete' | 'error' | 'job_done';
  payload?: any;
  jobId?: number;
}

export interface IMasterMessage {
  type: 'process_job';
  job: IJob;
}