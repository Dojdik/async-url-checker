import { JobStatus, UrlStatus, makeJob, makeUrl } from '../test-utils/job.factory';
import {
  deserializeJobFromIpc,
  isMasterMessage,
  serializeJobForIpc,
} from './job-ipc';
import { WorkerMessageType } from '../interfaces/worker-message.interface';

describe('job-ipc', () => {
  describe('serializeJobForIpc', () => {
    it('converts Dates to ISO strings', () => {
      const started = new Date('2026-01-02T03:04:05.000Z');
      const job = makeJob({
        id: 7,
        status: JobStatus.InProgress,
        urls: [
          makeUrl('https://example.com', UrlStatus.InProgress, {
            startedAt: started,
            httpStatus: undefined,
          }),
        ],
      });

      const dto = serializeJobForIpc(job);

      expect(dto.id).toBe(7);
      expect(typeof dto.createdAt).toBe('string');
      expect(dto.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(dto.urls[0].startedAt).toBe(started.toISOString());
      expect(dto.urls[0].startedAt).not.toBeInstanceOf(Date);
    });
  });

  describe('deserializeJobFromIpc', () => {
    it('round-trips serialize → JSON → deserialize', () => {
      const original = makeJob({
        id: 3,
        urls: [
          makeUrl('https://a.test', UrlStatus.Completed, {
            httpStatus: 200,
            startedAt: new Date('2026-01-01T00:00:00.000Z'),
            endedAt: new Date('2026-01-01T00:00:05.000Z'),
          }),
        ],
      });

      const wire = JSON.parse(JSON.stringify(serializeJobForIpc(original)));
      const revived = deserializeJobFromIpc(wire);

      expect(revived.id).toBe(3);
      expect(revived.createdAt).toBeInstanceOf(Date);
      expect(revived.urls[0].status).toBe(JobStatus.Completed);
      expect(revived.urls[0].httpStatus).toBe(200);
      expect(revived.urls[0].startedAt).toBeInstanceOf(Date);
      expect(revived.urls[0].endedAt?.toISOString()).toBe(
        '2026-01-01T00:00:05.000Z',
      );
    });

    it('allows missing optional url timestamps', () => {
      const revived = deserializeJobFromIpc({
        id: 1,
        status: JobStatus.Pending,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        urls: [{ url: 'https://x.test', status: JobStatus.Pending }],
      });
      expect(revived.urls[0].startedAt).toBeUndefined();
    });

    it('throws on invalid id', () => {
      expect(() =>
        deserializeJobFromIpc({
          id: 'x',
          status: JobStatus.Pending,
          urls: [],
        }),
      ).toThrow(/id/);
    });

    it('throws on invalid status', () => {
      expect(() =>
        deserializeJobFromIpc({
          id: 1,
          status: 'nope',
          urls: [],
        }),
      ).toThrow(/status/);
    });

    it('throws when urls is not an array', () => {
      expect(() =>
        deserializeJobFromIpc({
          id: 1,
          status: JobStatus.Pending,
          urls: null,
        }),
      ).toThrow(/urls/);
    });

    it('throws on invalid url entry', () => {
      expect(() =>
        deserializeJobFromIpc({
          id: 1,
          status: JobStatus.Pending,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          urls: [{ url: '', status: JobStatus.Pending }],
        }),
      ).toThrow(/url/);
    });
  });

  describe('isMasterMessage', () => {
    it('accepts objects with type string', () => {
      expect(isMasterMessage({ type: WorkerMessageType.Ready })).toBe(true);
      expect(isMasterMessage(null)).toBe(false);
      expect(isMasterMessage({ type: 1 })).toBe(false);
    });
  });
});
