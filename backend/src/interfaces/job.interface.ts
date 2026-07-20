import { UrlStatus } from "@/entities/job-url.entity";
import { JobStatus } from "@/entities/job.entity";

// interfaces/job.interface.ts
export interface IJob {
  id: number;
  urls: IJobUrl[];
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJobUrl {
  url: string;
  status: UrlStatus;
  httpStatus?: number;
  error?: string;
  startedAt: Date;
  endedAt?: Date;
}

// interfaces/job-processor.interface.ts
export interface IJobProcessor {
  process(job: IJob): Promise<void>;
  canProcess(job: IJob): boolean;
  getType(): string;
}

// interfaces/job-queue.interface.ts
export interface IJobQueue {
  enqueue(job: IJob): Promise<void>;
  dequeue(): Promise<IJob | null>;
  size(): Promise<number>;
  isEmpty(): Promise<boolean>;
}

// interfaces/job-repository.interface.ts
export interface IJobRepository {
  save(job: IJob): Promise<void>;
  findById(id: number): Promise<IJob | null>;
  updateStatus(id: number, status: JobStatus): Promise<void>;
  updateUrlStatus(url: string, status: UrlStatus, httpStatus?: number, error?: string): Promise<void>;
}

// interfaces/job-factory.interface.ts
export interface IJobFactory {
  create(urls: string[]): IJob;
  createUrl(url: string): IJobUrl;
}

// interfaces/http-client.interface.ts
export interface IHttpClient {
  head(url: string): Promise<{ status: number }>;
}

// interfaces/logger.interface.ts
export interface ILogger {
  info(message: string, context?: any): void;
  error(message: string, context?: any): void;
  warn(message: string, context?: any): void;
}