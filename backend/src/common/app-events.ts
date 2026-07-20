/**
 * In-process EventEmitter2 channel names (master only).
 * Not IPC — cluster messages use MasterMessageType / WorkerMessageType.
 */
export const AppEvents = {
  WorkerReady: 'worker.ready',
  WorkerError: 'worker.error',
  JobComplete: 'job.complete',
  JobTimeout: 'job.timeout',
  JobUrlProgress: 'job.url_progress',
} as const;

export type AppEvent = (typeof AppEvents)[keyof typeof AppEvents];
