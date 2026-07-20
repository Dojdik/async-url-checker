import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JobsModule } from '../jobs/job.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { WorkerPoolService } from './worker-pool.service';
import { JobDispatcherService } from './job-dispatcher.service';
import { MAX_WORKERS } from '../common/tokens';
import type { AppConfiguration } from '../config/configuration';

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
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration, true>) =>
        config.get('workersCount', { infer: true }),
    },
  ],
  exports: [JobDispatcherService, WorkerPoolService, InfrastructureModule],
})
export class MasterModule {}
