import { DynamicModule, Type } from '@nestjs/common';
import cluster from 'node:cluster';
import { IS_MASTER, IS_WORKER, WORKER_ID } from '../common/tokens';

export interface ClusterModuleOptions {
  workers: number;
  module: Type<unknown>;
  workerModule: Type<unknown>;
}

/**
 * Loads Master or Worker Nest module depending on the process role.
 */
export class ClusterModule {
  static forRoot(options: ClusterModuleOptions): DynamicModule {
    const isMaster = cluster.isPrimary;
    const isWorker = cluster.isWorker;

    return {
      module: ClusterModule,
      imports: [isMaster ? options.module : options.workerModule],
      providers: [
        { provide: IS_MASTER, useValue: isMaster },
        { provide: IS_WORKER, useValue: isWorker },
        {
          provide: WORKER_ID,
          useValue: isWorker ? cluster.worker?.id ?? null : null,
        },
      ],
      exports: [IS_MASTER, IS_WORKER, WORKER_ID],
    };
  }
}
