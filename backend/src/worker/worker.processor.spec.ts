import { JobStatus, UrlStatus, makeJob, makeUrl } from '../test-utils/job.factory';
import { WorkerProcessor } from './worker.processor';
import type { IHttpClient } from '../interfaces/http-client.interface';
import type { ConfigService } from '@nestjs/config';
import type { AppConfiguration } from '../config/configuration';
import { JobRepositoryService } from '../infrastructure/persistence/job-repository.service';
import type { IJob } from '../interfaces/job.interface';
import { WorkerMessageType } from '../interfaces/worker-message.interface';

describe('WorkerProcessor', () => {
  let processor: WorkerProcessor;
  let http: { head: jest.Mock };
  let repository: JobRepositoryService;
  let sent: unknown[];

  beforeEach(() => {
    http = {
      head: jest.fn().mockResolvedValue({ status: 200 }),
    };
    repository = new JobRepositoryService();
    sent = [];

    const config = {
      get: jest.fn((key: keyof AppConfiguration) => {
        if (key === 'maxConcurrentUrls') return 2;
        if (key === 'urlDelayMaxSeconds') return 0;
        return undefined;
      }),
    } as unknown as ConfigService<AppConfiguration, true>;

    processor = new WorkerProcessor(
      http as unknown as IHttpClient,
      repository,
      config,
    );

    // Avoid real process.send; capture IPC payloads
    jest.spyOn(process, 'send' as never).mockImplementation(((msg: unknown) => {
      sent.push(msg);
      return true;
    }) as never);
    Object.defineProperty(process, 'connected', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function runJob(job: IJob): Promise<void> {
    // processJob is private
    await (
      processor as unknown as { processJob: (j: IJob) => Promise<void> }
    ).processJob(job);
  }

  it('completes successful HEAD checks', async () => {
    const job = makeJob({
      id: 1,
      urls: [makeUrl('https://ok.test'), makeUrl('https://ok2.test')],
    });

    await runJob(job);

    expect(http.head).toHaveBeenCalledTimes(2);
    const stored = await repository.findById(1);
    expect(stored!.status).toBe(JobStatus.Completed);
    expect(stored!.urls.every((u) => u.status === UrlStatus.Completed)).toBe(true);
    expect(stored!.urls[0].httpStatus).toBe(200);

    const complete = sent.find(
      (m) => (m as { type?: string }).type === WorkerMessageType.Complete,
    ) as { type: string; jobId: number; payload: { status: string } };
    expect(complete?.jobId).toBe(1);
    expect(complete?.payload.status).toBe(JobStatus.Completed);
  });

  it('marks URL failed when HEAD rejects', async () => {
    http.head.mockRejectedValueOnce(new Error('network down'));
    const job = makeJob({
      id: 2,
      urls: [makeUrl('https://bad.test')],
    });

    await runJob(job);

    const stored = await repository.findById(2);
    expect(stored!.status).toBe(JobStatus.Failed);
    expect(stored!.urls[0].status).toBe(JobStatus.Failed);
    expect(stored!.urls[0].error).toBe('network down');
  });

  it('cancels pending URLs when job is cancelled before processing', async () => {
    (
      processor as unknown as { cancelledJobs: Set<number> }
    ).cancelledJobs.add(3);

    const job = makeJob({
      id: 3,
      urls: [
        makeUrl('https://a.test', UrlStatus.Pending),
        makeUrl('https://b.test', UrlStatus.Pending),
      ],
    });

    await runJob(job);

    expect(http.head).not.toHaveBeenCalled();
    const stored = await repository.findById(3);
    expect(stored!.status).toBe(JobStatus.Cancelled);
    expect(stored!.urls.every((u) => u.status === UrlStatus.Cancelled)).toBe(true);

    const msg = sent.find(
      (m) => (m as { type?: string }).type === WorkerMessageType.Cancelled,
    );
    expect(msg).toBeDefined();
  });

  it('limits concurrent HEAD requests', async () => {
    let active = 0;
    let maxActive = 0;
    const release: Array<() => void> = [];

    http.head.mockImplementation(
      () =>
        new Promise<{ status: number }>((resolve) => {
          active++;
          maxActive = Math.max(maxActive, active);
          release.push(() => {
            active--;
            resolve({ status: 200 });
          });
        }),
    );

    const job = makeJob({
      id: 4,
      urls: [
        makeUrl('https://1.test'),
        makeUrl('https://2.test'),
        makeUrl('https://3.test'),
        makeUrl('https://4.test'),
      ],
    });

    const running = runJob(job);

    // wait until max concurrency reached
    await waitFor(() => maxActive === 2);

    // release two, allow next batch
    release.splice(0, 2).forEach((fn) => fn());
    await waitFor(() => release.length >= 2);
    release.splice(0, 2).forEach((fn) => fn());

    await running;

    expect(maxActive).toBe(2);
    expect(http.head).toHaveBeenCalledTimes(4);
  });

  it('keeps finishing in-flight URL after cancel signal during HEAD', async () => {
    // concurrency 1 so the second URL stays pending when cancel arrives
    const config = {
      get: jest.fn((key: keyof AppConfiguration) => {
        if (key === 'maxConcurrentUrls') return 1;
        if (key === 'urlDelayMaxSeconds') return 0;
        return undefined;
      }),
    } as unknown as ConfigService<AppConfiguration, true>;

    const serialProcessor = new WorkerProcessor(
      http as unknown as IHttpClient,
      repository,
      config,
    );

    let resolveHead!: (v: { status: number }) => void;
    http.head.mockImplementation(
      () =>
        new Promise<{ status: number }>((resolve) => {
          resolveHead = resolve;
        }),
    );

    const job = makeJob({
      id: 5,
      urls: [
        makeUrl('https://slow.test'),
        makeUrl('https://pending.test'),
      ],
    });

    const running = (
      serialProcessor as unknown as {
        processJob: (j: IJob) => Promise<void>;
      }
    ).processJob(job);

    await waitFor(() => http.head.mock.calls.length === 1);

    (
      serialProcessor as unknown as { cancelledJobs: Set<number> }
    ).cancelledJobs.add(5);

    resolveHead({ status: 201 });
    await running;

    const stored = await repository.findById(5);
    expect(stored!.status).toBe(JobStatus.Cancelled);
    // first URL finished after cancel
    expect(stored!.urls[0].status).toBe(JobStatus.Completed);
    expect(stored!.urls[0].httpStatus).toBe(201);
    // second never started
    expect(stored!.urls[1].status).toBe(JobStatus.Cancelled);
  });
});

function waitFor(pred: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (pred()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('waitFor timeout'));
        return;
      }
      setImmediate(tick);
    };
    tick();
  });
}
