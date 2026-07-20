import { DynamicModule } from '@nestjs/common';
import cluster from 'cluster';

export class ClusterModule {
  static forRoot(options: {
    workers: number;
    module: any;
    workerModule: any;
  }): DynamicModule {
    const isMaster = cluster.isPrimary;
    const isWorker = cluster.isWorker;

    return {
      module: ClusterModule,
      imports: [
        // Импортируем нужный модуль в зависимости от типа процесса
        isMaster ? options.module : options.workerModule,
      ],
      providers: [
        {
          provide: 'IS_MASTER',
          useValue: isMaster,
        },
        {
          provide: 'IS_WORKER',
          useValue: isWorker,
        },
        {
          provide: 'WORKER_ID',
          useValue: isWorker ? cluster.worker?.id : null,
        },
      ],
      exports: ['IS_MASTER', 'IS_WORKER', 'WORKER_ID'],
    };
  }
}