import { JobStatus, UrlStatus, makeJob, makeUrl } from '../test-utils/job.factory';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JobDispatcherService } from './job-dispatcher.service';
import type { IJobRepository } from '../interfaces/job-repository.interface';
import type { IJobQueue } from '../interfaces/job-queue.interface';
import type { WorkerPoolService } from './worker-pool.service';
import { JobQueueService } from '../infrastructure/queue/job-queue.service';
import { JobRepositoryService } from '../infrastructure/persistence/job-repository.service';
import { AppEvents } from '../common/app-events';

describe('JobDispatcherService', () => {
  let dispatcher: JobDispatcherService;
  let repository: JobRepositoryService;
  let queue: JobQueueService;
  let workerPool: {
    getAvailableWorkersCount: jest.Mock;
    assignJob: jest.Mock;
    cancelJob: jest.Mock;
  };
  let events: EventEmitter2;

  beforeEach(() => {
    repository = new JobRepositoryService();
    queue = new JobQueueService();
    events = new EventEmitter2();
    workerPool = {
      getAvailableWorkersCount: jest.fn().mockReturnValue(1),
      assignJob: jest.fn().mockResolvedValue(undefined),
      cancelJob: jest.fn().mockReturnValue(true),
    };

    dispatcher = new JobDispatcherService(
      workerPool as unknown as WorkerPoolService,
      events,
      queue as IJobQueue,
      repository as IJobRepository,
    );
  });

  afterEach(() => {
    events.removeAllListeners();
  });

  it('dispatches queued job when workers are available', async () => {
    const job = makeJob({ id: 1 });
    await repository.save(job);

    await dispatcher.dispatchJob(job);

    expect(workerPool.assignJob).toHaveBeenCalledWith(job);
    const stored = await repository.findById(1);
    expect(stored!.status).toBe(JobStatus.InProgress);
  });

  it('does not assign cancelled jobs from the queue', async () => {
    const job = makeJob({ id: 1, status: JobStatus.Cancelled });
    await repository.save(job);
    await queue.enqueue(job);

    // trigger processQueue via ready
    events.emit(AppEvents.WorkerReady, { workerId: 1 });
    await flush();

    expect(workerPool.assignJob).not.toHaveBeenCalled();
  });

  it('marks job failed on worker.error unless cancelled', async () => {
    const job = makeJob({ id: 5, status: JobStatus.InProgress });
    await repository.save(job);

    events.emit(AppEvents.WorkerError, {
      jobId: 5,
      error: { error: 'Worker process died' },
    });
    await flush();

    expect((await repository.findById(5))!.status).toBe(JobStatus.Failed);
  });

  it('does not overwrite cancelled on worker.error', async () => {
    const job = makeJob({ id: 5, status: JobStatus.Cancelled });
    await repository.save(job);

    events.emit(AppEvents.WorkerError, { jobId: 5, error: { error: 'dead' } });
    await flush();

    expect((await repository.findById(5))!.status).toBe(JobStatus.Cancelled);
  });

  it('marks job failed on timeout', async () => {
    const job = makeJob({ id: 8, status: JobStatus.InProgress });
    await repository.save(job);

    events.emit(AppEvents.JobTimeout, { jobId: 8 });
    await flush();

    expect((await repository.findById(8))!.status).toBe(JobStatus.Failed);
  });

  it('merges complete results into repository', async () => {
    const job = makeJob({
      id: 2,
      status: JobStatus.InProgress,
      urls: [
        makeUrl('https://a.test', UrlStatus.InProgress),
        makeUrl('https://b.test', UrlStatus.Pending),
      ],
    });
    await repository.save(job);

    events.emit(AppEvents.JobComplete, {
      jobId: 2,
      result: {
        status: JobStatus.Completed,
        results: [
          { url: 'https://a.test', status: JobStatus.Completed, httpStatus: 200 },
          { url: 'https://b.test', status: JobStatus.Completed, httpStatus: 404 },
        ],
      },
    });
    await flush();

    const stored = (await repository.findById(2))!;
    expect(stored.status).toBe(JobStatus.Completed);
    expect(stored.urls[0].status).toBe(JobStatus.Completed);
    expect(stored.urls[0].httpStatus).toBe(200);
    expect(stored.urls[1].httpStatus).toBe(404);
  });

  it('on complete after cancel keeps cancelled and merges finished urls only', async () => {
    const job = makeJob({
      id: 3,
      status: JobStatus.Cancelled,
      urls: [
        makeUrl('https://a.test', UrlStatus.Cancelled),
        makeUrl('https://b.test', UrlStatus.InProgress),
      ],
    });
    await repository.save(job);

    events.emit(AppEvents.JobComplete, {
      jobId: 3,
      result: {
        status: JobStatus.Cancelled,
        results: [
          { url: 'https://a.test', status: JobStatus.Cancelled },
          {
            url: 'https://b.test',
            status: JobStatus.Completed,
            httpStatus: 200,
          },
        ],
      },
    });
    await flush();

    const stored = (await repository.findById(3))!;
    expect(stored.status).toBe(JobStatus.Cancelled);
    // cancelled result skipped by onlyFinished filter for non-finished
    expect(stored.urls[0].status).toBe(JobStatus.Cancelled);
    expect(stored.urls[1].status).toBe(JobStatus.Completed);
    expect(stored.urls[1].httpStatus).toBe(200);
  });

  it('cancelJob removes from queue, notifies pool, cancels repo', async () => {
    const job = makeJob({ id: 9, status: JobStatus.Pending });
    await repository.save(job);
    await queue.enqueue(job);

    const result = await dispatcher.cancelJob(9);

    expect(workerPool.cancelJob).toHaveBeenCalledWith(9);
    expect(result.status).toBe(JobStatus.Cancelled);
    await expect(queue.size()).resolves.toBe(0);
  });

  it('re-queues job when assignJob throws', async () => {
    workerPool.assignJob.mockRejectedValueOnce(new Error('No workers'));
    const job = makeJob({ id: 4 });
    await repository.save(job);

    await dispatcher.dispatchJob(job);
    await flush();

    // job put back on queue
    await expect(queue.size()).resolves.toBe(1);
  });
});

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
