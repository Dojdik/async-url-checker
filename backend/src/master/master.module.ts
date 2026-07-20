import { Module, forwardRef } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JobsModule } from '../jobs/job.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { WorkerPoolService } from './worker-pool.service';
import { JobDispatcherService } from './job-dispatcher.service';
import { MAX_WORKERS } from '../common/tokens';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    InfrastructureModule,
    forwardRef(() => JobsModule),
  ],
  providers: [
    WorkerPoolService,
    JobDispatcherService,
    {
      provide: MAX_WORKERS,
      useValue: Number(process.env.WORKERS_COUNT) || 2,
    },
  ],
  exports: [JobDispatcherService, WorkerPoolService, InfrastructureModule],
})
export class MasterModule {}
