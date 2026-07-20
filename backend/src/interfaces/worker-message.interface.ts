export interface IWorkerMessage {
  type: 'ready' | 'complete' | 'error' | 'job_done';
  payload?: unknown;
  jobId?: number;
}
