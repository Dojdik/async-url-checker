import { ILogger } from "@/interfaces/job.interface";

@Injectable()
export class JobQueueService implements IJobQueue {
  private queue: IJob[] = [];
  private processing = 0;
  private readonly maxConcurrent: number;
  private isProcessing = false;
  
  constructor(
    @Inject('MAX_CONCURRENT') maxConcurrent: number = 5,
    @Inject('IJobProcessor') private readonly processor: IJobProcessor,
    @Inject('IJobRepository') private readonly repository: IJobRepository,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {
    this.maxConcurrent = maxConcurrent;
  }
  
  async enqueue(job: IJob): Promise<void> {
    this.queue.push(job);
    this.logger.info(`Job ${job.id} enqueued`, { jobId: job.id });
    await this.processQueue();
  }
  
  async dequeue(): Promise<IJob | null> {
    return this.queue.shift() || null;
  }
  
  async size(): Promise<number> {
    return this.queue.length;
  }
  
  async isEmpty(): Promise<boolean> {
    return this.queue.length === 0;
  }
  
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0 && this.processing < this.maxConcurrent) {
      const job = await this.dequeue();
      if (!job) break;
      
      this.processing++;
      this.processJob(job).finally(() => {
        this.processing--;
        this.processQueue();
      });
    }
    
    this.isProcessing = false;
  }
  
  private async processJob(job: IJob): Promise<void> {
    try {
      await this.repository.updateStatus(job.id, 'in_progress');
      await this.processor.process(job);
      await this.repository.updateStatus(job.id, 'completed');
      this.logger.info(`Job ${job.id} completed successfully`);
    } catch (error) {
      await this.repository.updateStatus(job.id, 'failed');
      this.logger.error(`Job ${job.id} failed`, { error: error.message });
    }
  }
}
