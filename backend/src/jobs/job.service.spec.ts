import { JobStatus, UrlStatus, makeJob, makeUrl } from '../test-utils/job.factory';
import { ApiUrlStatus } from './dto/job-detail.dto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JobService } from './job.service';
import type { IJobRepository } from '../interfaces/job-repository.interface';
import type { IJobFactory } from '../interfaces/job-factory.interface';
import type { JobDispatcherService } from '../master/job-dispatcher.service';

describe('JobService', () => {
  let service: JobService;
  let repository: jest.Mocked<IJobRepository>;
  let factory: jest.Mocked<IJobFactory>;
  let dispatcher: { dispatchJob: jest.Mock; cancelJob: jest.Mock };

  beforeEach(() => {
    repository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
      updateUrlStatus: jest.fn(),
      cancel: jest.fn(),
      delete: jest.fn(),
    };
    factory = {
      create: jest.fn(),
      createUrl: jest.fn(),
    };
    dispatcher = {
      dispatchJob: jest.fn().mockResolvedValue(undefined),
      cancelJob: jest.fn(),
    };

    service = new JobService(
      repository,
      factory,
      dispatcher as unknown as JobDispatcherService,
    );
  });

  describe('create', () => {
    it('rejects empty urls', async () => {
      await expect(service.create([])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('saves and dispatches a new job', async () => {
      const job = makeJob({ id: 10, status: JobStatus.Pending });
      factory.create.mockReturnValue(job);

      const result = await service.create(['https://example.com']);

      expect(factory.create).toHaveBeenCalledWith(['https://example.com']);
      expect(repository.save).toHaveBeenCalledWith(job);
      expect(dispatcher.dispatchJob).toHaveBeenCalledWith(job);
      expect(result).toEqual({
        id: 10,
        status: JobStatus.Pending,
        createdAt: job.createdAt,
      });
    });
  });

  describe('findAll', () => {
    it('maps jobs to list items with stats', async () => {
      const job = makeJob({
        id: 1,
        urls: [
          makeUrl('https://a.test', UrlStatus.Completed),
          makeUrl('https://b.test', UrlStatus.Failed),
          makeUrl('https://c.test', UrlStatus.Pending),
        ],
      });
      repository.findAll.mockResolvedValue([job]);

      const list = await service.findAll(0, 10);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: 1,
        urlsCount: 3,
        stats: {
          succeeded: 1,
          failed: 1,
          pending: 1,
          in_progress: 0,
          cancelled: 0,
        },
      });
    });
  });

  describe('find', () => {
    it('throws NotFound when missing', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.find(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns detail with API url statuses and duration', async () => {
      const started = new Date('2026-01-01T00:00:00.000Z');
      const ended = new Date('2026-01-01T00:00:02.500Z');
      const job = makeJob({
        id: 2,
        urls: [
          makeUrl('https://a.test', UrlStatus.Completed, {
            httpStatus: 200,
            startedAt: started,
            endedAt: ended,
          }),
          makeUrl('https://b.test', UrlStatus.Failed, {
            error: 'timeout',
            startedAt: started,
            endedAt: ended,
          }),
        ],
      });
      repository.findById.mockResolvedValue(job);

      const detail = await service.find(2);
      expect(detail.urls[0].status).toBe(ApiUrlStatus.Success);
      expect(detail.urls[0].durationMs).toBe(2500);
      expect(detail.urls[1].status).toBe(ApiUrlStatus.Error);
      expect(detail.urls[1].error).toBe('timeout');
    });
  });

  describe('cancel', () => {
    it('throws NotFound when missing', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.cancel(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Conflict for terminal jobs', async () => {
      repository.findById.mockResolvedValue(
        makeJob({ id: 1, status: JobStatus.Completed }),
      );
      await expect(service.cancel(1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('delegates to dispatcher for active jobs', async () => {
      const job = makeJob({ id: 1, status: JobStatus.InProgress });
      const cancelled = { ...job, status: JobStatus.Cancelled };
      repository.findById.mockResolvedValue(job);
      dispatcher.cancelJob.mockResolvedValue(cancelled);

      await expect(service.cancel(1)).resolves.toEqual(cancelled);
      expect(dispatcher.cancelJob).toHaveBeenCalledWith(1);
    });
  });
});
