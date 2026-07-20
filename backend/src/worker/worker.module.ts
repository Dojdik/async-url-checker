import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { WorkerProcessor } from './worker.processor';

@Module({
  imports: [InfrastructureModule],
  providers: [WorkerProcessor],
})
export class WorkerModule {}
