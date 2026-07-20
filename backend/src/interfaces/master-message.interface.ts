import type { JobIpcDto } from '../common/job-ipc';

/** Master → worker over cluster IPC (JSON-safe job DTO). */
export type IMasterMessage =
  | {
      type: 'process_job';
      job: JobIpcDto;
    }
  | {
      type: 'cancel_job';
      jobId: number;
    };
