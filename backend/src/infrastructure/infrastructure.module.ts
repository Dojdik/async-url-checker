import { Module } from '@nestjs/common';
import { JobFactory } from '../domain/factories/job.factory';
import {
  HTTP_CLIENT,
  JOB_FACTORY,
  JOB_QUEUE,
  JOB_REPOSITORY,
  LOGGER,
} from '../common/tokens';
import { HttpClientService } from './http/http-client.service';
import { JobRepositoryService } from './persistence/job-repository.service';
import { JobQueueService } from './queue/job-queue.service';
import { ConsoleLoggerService } from './logging/console-logger.service';

/**
 * Infrastructure adapters bound to application ports (DIP).
 * Import where concrete implementations are needed.
 */
@Module({
  providers: [
    { provide: JOB_REPOSITORY, useClass: JobRepositoryService },
    { provide: JOB_QUEUE, useClass: JobQueueService },
    { provide: HTTP_CLIENT, useClass: HttpClientService },
    { provide: LOGGER, useClass: ConsoleLoggerService },
    { provide: JOB_FACTORY, useClass: JobFactory },
    JobFactory,
    JobRepositoryService,
    JobQueueService,
    HttpClientService,
    ConsoleLoggerService,
  ],
  exports: [
    JOB_REPOSITORY,
    JOB_QUEUE,
    HTTP_CLIENT,
    LOGGER,
    JOB_FACTORY,
    JobFactory,
    JobRepositoryService,
    JobQueueService,
    HttpClientService,
    ConsoleLoggerService,
  ],
})
export class InfrastructureModule {}
