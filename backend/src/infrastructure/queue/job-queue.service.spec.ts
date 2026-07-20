import { JobQueueService } from './job-queue.service';
import { makeJob } from '../../test-utils/job.factory';

describe('JobQueueService', () => {
  let queue: JobQueueService;

  beforeEach(() => {
    queue = new JobQueueService();
  });

  it('enqueues and dequeues FIFO', async () => {
    const a = makeJob({ id: 1 });
    const b = makeJob({ id: 2 });
    await queue.enqueue(a);
    await queue.enqueue(b);

    await expect(queue.size()).resolves.toBe(2);
    await expect(queue.dequeue()).resolves.toEqual(a);
    await expect(queue.dequeue()).resolves.toEqual(b);
    await expect(queue.dequeue()).resolves.toBeNull();
    await expect(queue.isEmpty()).resolves.toBe(true);
  });

  it('removes by job id', async () => {
    await queue.enqueue(makeJob({ id: 1 }));
    await queue.enqueue(makeJob({ id: 2 }));
    await queue.enqueue(makeJob({ id: 3 }));

    await expect(queue.remove(2)).resolves.toMatchObject({ id: 2 });
    await expect(queue.remove(99)).resolves.toBeNull();
    await expect(queue.size()).resolves.toBe(2);
    await expect(queue.dequeue()).resolves.toMatchObject({ id: 1 });
    await expect(queue.dequeue()).resolves.toMatchObject({ id: 3 });
  });
});
