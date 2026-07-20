import { Module } from '@nestjs/common';
import { WorkerPoolService } from './worker-pool.service';
import { JobDispatcherService } from './job-dispatcher.service';
import { JobService } from '@/jobs/job.service';
import { JobRepositoryService } from '@/shared/job-repository.service';
import { JobQueueService } from '@/shared/job-queue.service';

@Module({
  providers: [
    WorkerPoolService,
    JobDispatcherService,
    JobService,
    {
      provide: 'IJobRepository',
      useClass: JobRepositoryService,
    },
    {
      provide: 'IJobQueue',
      useClass: JobQueueService,
    },
    {
      provide: 'MAX_WORKERS',
      useValue: Number(process.env.WORKERS_COUNT) || 5,
    },
  ],
})
export class MasterModule {}