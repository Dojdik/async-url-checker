import cluster from 'cluster';
import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IMasterMessage, IWorkerMessage } from '@/interfaces/message.interface';
import { IJob } from '@/interfaces/job.interface';

@Injectable()
export class WorkerPoolService implements OnModuleInit, OnModuleDestroy {
  private workers: cluster.Worker[] = [];
  private availableWorkers: Set<cluster.Worker> = new Set();
  private readonly MAX_WORKERS: number;
  private isShuttingDown = false;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject('MAX_WORKERS') maxWorkers: number = 5,
  ) {
    this.MAX_WORKERS = maxWorkers;
  }

  onModuleInit() {
    this.createWorkers();
    this.setupClusterEvents();
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
    this.disconnectWorkers();
  }

  private createWorkers() {
    for (let i = 0; i < this.MAX_WORKERS; i++) {
      const worker = cluster.fork();
      this.workers.push(worker);
      this.availableWorkers.add(worker);
      
      // Ждем готовности воркера
      worker.once('message', (msg: IWorkerMessage) => {
        if (msg.type === 'ready') {
          console.log(`Worker ${worker.id} is ready`);
          this.eventEmitter.emit('worker.ready', { workerId: worker.id });
        }
      });
    }
  }

  private setupClusterEvents() {
    // Воркер завершил задачу
    this.eventEmitter.on('worker.complete', (data: any) => {
      const { workerId, jobId, result } = data;
      const worker = this.workers.find(w => w.id === workerId);
      if (worker) {
        this.availableWorkers.add(worker);
        this.eventEmitter.emit('job.complete', { jobId, result });
      }
    });

    // Воркер упал - создаем новый
    cluster.on('exit', (worker) => {
      if (!this.isShuttingDown) {
        console.log(`Worker ${worker.id} died. Creating new one...`);
        const newWorker = cluster.fork();
        this.workers = this.workers.map(w => 
          w.id === worker.id ? newWorker : w
        );
        this.availableWorkers.delete(worker);
        
        // Ждем готовности нового воркера
        newWorker.once('message', (msg: IWorkerMessage) => {
          if (msg.type === 'ready') {
            this.availableWorkers.add(newWorker);
          }
        });
      }
    });
  }

  async assignJob(job: IJob): Promise<void> {
    if (this.availableWorkers.size === 0) {
      throw new Error('No workers available');
    }

    // Берем первого доступного воркера
    const worker = this.availableWorkers.values().next().value;
    this.availableWorkers.delete(worker);

    // Отправляем задачу воркеру
    const message: IMasterMessage = {
      type: 'process_job',
      job,
    };
    worker.send(message);

    // Устанавливаем таймаут на выполнение
    const timeout = setTimeout(() => {
      console.log(`Worker ${worker.id} timed out on job ${job.id}`);
      this.availableWorkers.add(worker);
      this.eventEmitter.emit('job.timeout', { jobId: job.id });
    }, 30000); // 30 секунд

    // Возвращаем воркер в пул после выполнения
    const onMessage = (msg: IWorkerMessage) => {
      if (msg.jobId === job.id && (msg.type === 'complete' || msg.type === 'error')) {
        clearTimeout(timeout);
        this.availableWorkers.add(worker);
        worker.off('message', onMessage);
        
        if (msg.type === 'complete') {
          this.eventEmitter.emit('worker.complete', {
            workerId: worker.id,
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
      }
    };

    worker.on('message', onMessage);
  }

  private disconnectWorkers() {
    for (const worker of this.workers) {
      worker.disconnect();
    }
  }

  getAvailableWorkersCount(): number {
    return this.availableWorkers.size;
  }

  getTotalWorkersCount(): number {
    return this.workers.length;
  }
}