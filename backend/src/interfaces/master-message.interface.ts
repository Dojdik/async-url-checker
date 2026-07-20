import type { JobIpcDto } from '../common/job-ipc';
import { MasterMessageType } from './ipc-message.types';

/** Master → worker over cluster IPC (JSON-safe job DTO). */
export type IMasterMessage =
  | {
      type: typeof MasterMessageType.ProcessJob;
      job: JobIpcDto;
    }
  | {
      type: typeof MasterMessageType.CancelJob;
      jobId: number;
    };

export { MasterMessageType };
