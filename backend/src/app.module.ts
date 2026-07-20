import { Module } from '@nestjs/common';
import { MasterModule } from './master/master.module';
import { WorkerModule } from './worker/worker.module';
import { ClusterModule } from './cluster/cluster.module';

@Module({
  imports: [
    ClusterModule.forRoot({
      workers: Number(process.env.WORKERS_COUNT) || 2,
      module: MasterModule,
      workerModule: WorkerModule,
    }),
  ],
})
export class AppModule {}
