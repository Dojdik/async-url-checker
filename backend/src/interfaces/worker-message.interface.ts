import type { UrlStatus } from '../domain/types/url-status.type';
import {
  WorkerMessageType,
  type WorkerMessageType as WorkerMessageTypeValue,
} from './ipc-message.types';

export { WorkerMessageType };

export interface IWorkerMessage {
  type: WorkerMessageTypeValue;
  payload?: unknown;
  jobId?: number;
}

export interface IUrlProgressPayload {
  url: string;
  status: UrlStatus;
  httpStatus?: number;
  error?: string;
}
