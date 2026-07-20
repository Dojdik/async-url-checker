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
import { serializeJobForIpc } from '../common/job-ipc';
import { MAX_WORKERS } from '../common/tokens';

interface JobAssignment {
  worker: Worker;
  timeout: NodeJS.Timeout;
  onMessage: (msg: IWorkerMessage) => void;
}

/**
 * Manages cluster workers and job assignments.
 * - Serializes jobs for IPC
 * - Tracks assignments so dead/timed-out workers fail jobs cleanly
 * - Ignores late messages after release
 */
@Injectable()
export class WorkerPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerPoolService.name);
  private workers: Worker[] = [];
  private readonly availableWorkers = new Set<Worker>();
  private readonly readyWorkers = new Set<number>();
  private readonly jobAssignments = new Map<number, JobAssignment>();
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

    // Keep listening until ready (not only the first message)
    const onReady = (msg: IWorkerMessage) => {
      if (msg?.type !== 'ready') {
        return;
      }
      worker.off('message', onReady);
      this.markWorkerReady(worker);
    };
    worker.on('message', onReady);

    return worker;
  }

  private markWorkerReady(worker: Worker): void {
    if (this.isShuttingDown || !worker.isConnected()) {
      return;
    }
    if (this.readyWorkers.has(worker.id)) {
      return;
    }
    this.readyWorkers.add(worker.id);
    this.availableWorkers.add(worker);
    this.logger.log(`Worker ${worker.id} is ready`);
    this.eventEmitter.emit('worker.ready', { workerId: worker.id });
  }

  private setupClusterEvents(): void {
    cluster.on('exit', (worker, code, signal) => {
      this.workers = this.workers.filter((w) => w.id !== worker.id);
      this.availableWorkers.delete(worker);
      this.readyWorkers.delete(worker.id);

      const orphanedJobIds = this.detachJobsFromWorker(worker);

      for (const jobId of orphanedJobIds) {
        this.logger.error(
          `Worker ${worker.id} died mid-job ${jobId} (code=${code}, signal=${signal})`,
        );
        this.eventEmitter.emit('worker.error', {
          workerId: worker.id,
          jobId,
          error: { error: 'Worker process died' },
        });
      }

      if (this.isShuttingDown) {
        return;
      }

      this.logger.warn(
        `Worker ${worker.id} exited (code=${code}, signal=${signal}). Spawning replacement...`,
      );
      this.spawnWorker();
    });
  }

  /**
   * Clear assignments for a dead/retired worker; return orphaned job ids.
   */
  private detachJobsFromWorker(worker: Worker): number[] {
    const orphaned: number[] = [];
    for (const [jobId, assignment] of this.jobAssignments) {
      if (assignment.worker.id !== worker.id) {
        continue;
      }
      clearTimeout(assignment.timeout);
      assignment.worker.off('message', assignment.onMessage);
      this.jobAssignments.delete(jobId);
      orphaned.push(jobId);
    }
    return orphaned;
  }

  async assignJob(job: IJob): Promise<void> {
    if (this.availableWorkers.size === 0) {
      throw new Error('No workers available');
    }

    const worker = this.availableWorkers.values().next().value as Worker;
    this.availableWorkers.delete(worker);

    if (!worker.isConnected()) {
      throw new Error(`Worker ${worker.id} is not connected`);
    }

    const message: IMasterMessage = {
      type: 'process_job',
      job: serializeJobForIpc(job),
    };

    const timeoutMs = Math.max(60_000, job.urls.length * 12_000);

    const onMessage = (msg: IWorkerMessage) => {
      // Ignore late messages after assignment was released
      const current = this.jobAssignments.get(job.id);
      if (!current || current.worker.id !== worker.id) {
        return;
      }
      if (msg.jobId !== job.id) {
        return;
      }

      if (msg.type === 'url_progress') {
        this.eventEmitter.emit('job.url_progress', {
          jobId: job.id,
          progress: msg.payload,
        });
        return;
      }

      if (
        msg.type !== 'complete' &&
        msg.type !== 'error' &&
        msg.type !== 'cancelled'
      ) {
        return;
      }

      this.finishAssignment(job.id, worker, onMessage, timeout, {
        returnToPool: true,
        after: () => {
          if (msg.type === 'complete' || msg.type === 'cancelled') {
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
        },
      });
    };

    const timeout = setTimeout(() => {
      const current = this.jobAssignments.get(job.id);
      if (!current || current.worker.id !== worker.id) {
        return;
      }

      this.logger.warn(
        `Worker ${worker.id} timed out on job ${job.id} — retiring worker`,
      );

      // Do not return worker to pool: kill so in-flight HEAD/delay stop
      this.finishAssignment(job.id, worker, onMessage, timeout, {
        returnToPool: false,
        after: () => {
          this.eventEmitter.emit('job.timeout', { jobId: job.id });
        },
      });
      this.retireWorker(worker, 'timeout');
    }, timeoutMs);

    this.jobAssignments.set(job.id, { worker, timeout, onMessage });
    worker.on('message', onMessage);
    worker.send(message);
  }

  /**
   * Complete assignment once: clear timeout, drop map entry, optional pool return.
   */
  private finishAssignment(
    jobId: number,
    worker: Worker,
    onMessage: (msg: IWorkerMessage) => void,
    timeout: NodeJS.Timeout,
    options: { returnToPool: boolean; after: () => void },
  ): void {
    const current = this.jobAssignments.get(jobId);
    if (!current || current.worker.id !== worker.id) {
      return;
    }

    clearTimeout(timeout);
    worker.off('message', onMessage);
    this.jobAssignments.delete(jobId);

    options.after();

    if (
      options.returnToPool &&
      !this.isShuttingDown &&
      worker.isConnected() &&
      this.readyWorkers.has(worker.id) &&
      !this.isWorkerBusy(worker)
    ) {
      this.availableWorkers.add(worker);
      this.eventEmitter.emit('worker.ready', { workerId: worker.id });
    }
  }

  private isWorkerBusy(worker: Worker): boolean {
    for (const assignment of this.jobAssignments.values()) {
      if (assignment.worker.id === worker.id) {
        return true;
      }
    }
    return false;
  }

  /**
   * Kill a stuck worker and spawn a replacement (timeout path).
   */
  private retireWorker(worker: Worker, reason: string): void {
    this.availableWorkers.delete(worker);
    this.readyWorkers.delete(worker.id);
    this.logger.warn(`Retiring worker ${worker.id} (${reason})`);

    try {
      worker.kill('SIGTERM');
    } catch {
      // exit handler will spawn replacement
    }
  }

  /**
   * Ask the worker processing this job to stop picking up pending URLs.
   */
  cancelJob(jobId: number): boolean {
    const assignment = this.jobAssignments.get(jobId);
    if (!assignment || !assignment.worker.isConnected()) {
      return false;
    }

    const message: IMasterMessage = {
      type: 'cancel_job',
      jobId,
    };
    assignment.worker.send(message);
    this.logger.log(
      `Cancel signal sent to worker ${assignment.worker.id} for job ${jobId}`,
    );
    return true;
  }

  private disconnectWorkers(): void {
    for (const [, assignment] of this.jobAssignments) {
      clearTimeout(assignment.timeout);
      assignment.worker.off('message', assignment.onMessage);
    }
    this.jobAssignments.clear();

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
    this.readyWorkers.clear();
  }

  getAvailableWorkersCount(): number {
    return this.availableWorkers.size;
  }

  getTotalWorkersCount(): number {
    return this.workers.length;
  }
}
