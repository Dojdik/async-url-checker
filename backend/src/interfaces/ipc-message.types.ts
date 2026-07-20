/** Master → worker IPC message types. */
export const MasterMessageType = {
  ProcessJob: 'process_job',
  CancelJob: 'cancel_job',
} as const;

export type MasterMessageType =
  (typeof MasterMessageType)[keyof typeof MasterMessageType];

/** Worker → master IPC message types. */
export const WorkerMessageType = {
  Ready: 'ready',
  Complete: 'complete',
  Error: 'error',
  Cancelled: 'cancelled',
  UrlProgress: 'url_progress',
  JobDone: 'job_done',
} as const;

export type WorkerMessageType =
  (typeof WorkerMessageType)[keyof typeof WorkerMessageType];

export const WORKER_MESSAGE_TYPES = [
  WorkerMessageType.Ready,
  WorkerMessageType.Complete,
  WorkerMessageType.Error,
  WorkerMessageType.Cancelled,
  WorkerMessageType.UrlProgress,
  WorkerMessageType.JobDone,
] as const satisfies readonly WorkerMessageType[];
