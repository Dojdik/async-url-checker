import cluster, { type Worker } from 'node:cluster';
import path from 'node:path';
import {
  Injectable,
  OnModuleDestroy,
  Inject,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { IMasterMessage } from '../interfaces/master-message.interface';
import type { IWorkerMessage } from '../interfaces/worker-message.interface';
import type { IJob } from '../interfaces/job.interface';
import { MAX_WORKERS } from '../common/tokens';

@Injectable()
export class WorkerPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerPoolService.name);
  private workers: Worker[] = [];
  private readonly availableWorkers = new Set<Worker>();
  private readonly maxWorkers: number;
  private isShuttingDown = false;
  private started = false;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject(MAX_WORKERS) maxWorkers: number,
  ) {
    this.maxWorkers = maxWorkers;
  }

  /**
   * Start workers only after the HTTP server is listening,
   * so a bind failure does not leave orphan cluster processes.
   */
  start(): void {
    if (this.started || !cluster.isPrimary) {
      return;
    }
    this.started = true;
    this.configureClusterExec();
    this.setupClusterEvents();
    this.createWorkers();
  }

  /**
   * Ensure cluster.fork() has a valid entry script (fails when argv[1] is unset).
   */
  private configureClusterExec(): void {
    const execArgv = process.execArgv.filter(
      (arg) => !arg.startsWith('--inspect'),
    );
    const exec =
      process.argv[1] ?? path.join(__dirname, '..', 'main.js');

    cluster.setupPrimary({
      exec,
      execArgv,
    });
  }

  onModuleDestroy(): void {
    this.isShuttingDown = true;
    this.disconnectWorkers();
  }

  private createWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.spawnWorker();
    }
  }

  private spawnWorker(): Worker {
    const worker = cluster.fork();
    this.workers.push(worker);

    worker.on('error', (err) => {
      this.logger.warn(`Worker error: ${err.message}`);
    });

    worker.once('message', (msg: IWorkerMessage) => {
      if (msg.type === 'ready') {
        this.logger.log(`Worker ${worker.id} is ready`);
        this.availableWorkers.add(worker);
        this.eventEmitter.emit('worker.ready', { workerId: worker.id });
      }
    });

    return worker;
  }

  private setupClusterEvents(): void {
    cluster.on('exit', (worker, code, signal) => {
      this.workers = this.workers.filter((w) => w.id !== worker.id);
      this.availableWorkers.delete(worker);

      if (this.isShuttingDown) {
        return;
      }

      this.logger.warn(
        `Worker ${worker.id} died (code=${code}, signal=${signal}). Creating a new one...`,
      );
      this.spawnWorker();
    });
  }

  async assignJob(job: IJob): Promise<void> {
    if (this.availableWorkers.size === 0) {
      throw new Error('No workers available');
    }

    const worker = this.availableWorkers.values().next().value as Worker;
    this.availableWorkers.delete(worker);

    const message: IMasterMessage = {
      type: 'process_job',
      job,
    };

    if (!worker.isConnected()) {
      throw new Error(`Worker ${worker.id} is not connected`);
    }

    worker.send(message);

    const timeout = setTimeout(() => {
      this.logger.warn(`Worker ${worker.id} timed out on job ${job.id}`);
      this.availableWorkers.add(worker);
      this.eventEmitter.emit('job.timeout', { jobId: job.id });
      worker.off('message', onMessage);
    }, 30_000);

    const onMessage = (msg: IWorkerMessage) => {
      if (msg.jobId !== job.id) {
        return;
      }
      if (msg.type !== 'complete' && msg.type !== 'error') {
        return;
      }

      clearTimeout(timeout);
      this.availableWorkers.add(worker);
      worker.off('message', onMessage);

      if (msg.type === 'complete') {
        this.eventEmitter.emit('worker.complete', {
          workerId: worker.id,
          jobId: job.id,
          result: msg.payload,
        });
        this.eventEmitter.emit('job.complete', {
          jobId: job.id,
          result: msg.payload,
        });
      } else {
        this.eventEmitter.emit('worker.error', {
          workerId: worker.id,
          jobId: job.id,
          error: msg.payload,
        });
      }
    };

    worker.on('message', onMessage);
  }

  private disconnectWorkers(): void {
    for (const worker of this.workers) {
      try {
        worker.process.removeAllListeners('error');
        worker.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
    this.workers = [];
    this.availableWorkers.clear();
  }

  getAvailableWorkersCount(): number {
    return this.availableWorkers.size;
  }

  getTotalWorkersCount(): number {
    return this.workers.length;
  }
}
