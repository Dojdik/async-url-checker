import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MasterModule } from './master/master.module';
import { WorkerModule } from './worker/worker.module';
import { ClusterModule } from './cluster/cluster.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Local overrides first, then .env
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
    }),
    ClusterModule.forRoot({
      module: MasterModule,
      workerModule: WorkerModule,
    }),
  ],
})
export class AppModule {}
