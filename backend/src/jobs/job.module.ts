import { Module, forwardRef } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { MasterModule } from '../master/master.module';

/**
 * Jobs feature module: HTTP API + application service (SRP).
 * Depends on master dispatcher via DIP (exported from MasterModule).
 */
@Module({
  imports: [InfrastructureModule, forwardRef(() => MasterModule)],
  controllers: [JobController],
  providers: [JobService],
  exports: [JobService],
})
export class JobsModule {}
