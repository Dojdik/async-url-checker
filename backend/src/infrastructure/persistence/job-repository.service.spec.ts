import { JobStatus, UrlStatus, makeJob, makeUrl } from '../../test-utils/job.factory';
import { NotFoundException } from '@nestjs/common';
import { JobRepositoryService } from './job-repository.service';

describe('JobRepositoryService', () => {
  let repo: JobRepositoryService;

  beforeEach(() => {
    repo = new JobRepositoryService();
  });

  it('saves and finds by id', async () => {
    const job = makeJob({ id: 5 });
    await repo.save(job);
    await expect(repo.findById(5)).resolves.toEqual(job);
    await expect(repo.findById(99)).resolves.toBeNull();
  });

  it('findAll sorts by id and paginates', async () => {
    await repo.save(makeJob({ id: 3 }));
    await repo.save(makeJob({ id: 1 }));
    await repo.save(makeJob({ id: 2 }));

    const page = await repo.findAll(1, 2);
    expect(page.map((j) => j.id)).toEqual([2, 3]);
  });

  it('updateStatus does not overwrite cancelled', async () => {
    const job = makeJob({ id: 1, status: JobStatus.Cancelled });
    await repo.save(job);
    await repo.updateStatus(1, JobStatus.Completed);
    expect((await repo.findById(1))!.status).toBe(JobStatus.Cancelled);
  });

  it('updateUrlStatus sets startedAt on in_progress', async () => {
    const job = makeJob({
      id: 1,
      urls: [makeUrl('https://a.test', UrlStatus.Pending)],
    });
    await repo.save(job);

    await repo.updateUrlStatus(1, 'https://a.test', UrlStatus.InProgress);
    const updated = (await repo.findById(1))!.urls[0];
    expect(updated.status).toBe(JobStatus.InProgress);
    expect(updated.startedAt).toBeInstanceOf(Date);
  });

  it('updateUrlStatus sets endedAt on terminal states', async () => {
    const job = makeJob({
      id: 1,
      urls: [makeUrl('https://a.test', UrlStatus.InProgress)],
    });
    await repo.save(job);

    await repo.updateUrlStatus(1, 'https://a.test', UrlStatus.Completed, 200);
    const updated = (await repo.findById(1))!.urls[0];
    expect(updated.httpStatus).toBe(200);
    expect(updated.endedAt).toBeInstanceOf(Date);
  });

  it('throws when job or url missing', async () => {
    await expect(repo.updateStatus(1, JobStatus.Pending)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    await repo.save(makeJob({ id: 1, urls: [makeUrl('https://a.test')] }));
    await expect(
      repo.updateUrlStatus(1, 'https://missing.test', UrlStatus.Failed),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cancel marks job and pending urls', async () => {
    const job = makeJob({
      id: 1,
      status: JobStatus.InProgress,
      urls: [
        makeUrl('https://a.test', UrlStatus.Pending),
        makeUrl('https://b.test', UrlStatus.InProgress),
      ],
    });
    await repo.save(job);

    const cancelled = await repo.cancel(1);
    expect(cancelled!.status).toBe(JobStatus.Cancelled);
    expect(cancelled!.urls[0].status).toBe(JobStatus.Cancelled);
    expect(cancelled!.urls[1].status).toBe(JobStatus.InProgress);
  });

  it('delete removes job', async () => {
    await repo.save(makeJob({ id: 1 }));
    await expect(repo.delete(1)).resolves.toBe(true);
    await expect(repo.findById(1)).resolves.toBeNull();
  });
});
