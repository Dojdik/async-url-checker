import { Module } from '@nestjs/common';
import { WorkerProcessor } from './worker.processor';
import { JobRepositoryService } from '../shared/job-repository.service';
import { JobQueueService } from '../shared/job-queue.service';
import { HttpClientService } from '../shared/http-client.service';

@Module({
  providers: [
    WorkerProcessor,
    {
      provide: 'IJobRepository',
      useClass: JobRepositoryService,
    },
    {
      provide: 'IJobQueue',
      useClass: JobQueueService,
    },
    {
      provide: 'IHttpClient',
      useClass: HttpClientService,
    },
  ],
})
export class WorkerModule {}