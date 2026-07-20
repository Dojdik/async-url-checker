import {
  cancelPendingUrls,
  countUrlStatuses,
  resolveJobStatusFromUrls,
} from './job-rules';
import { JobStatus, UrlStatus, makeJob, makeUrl } from '../test-utils/job.factory';
import {
  canCancelJob,
  isTerminalJobStatus,
} from './types/job-status.type';

describe('job-rules', () => {
  describe('cancelPendingUrls', () => {
    it('cancels only pending URLs and sets endedAt', () => {
      const now = new Date('2026-06-01T12:00:00.000Z');
      const job = makeJob({
        urls: [
          makeUrl('https://a.test', UrlStatus.Pending),
          makeUrl('https://b.test', UrlStatus.InProgress, {
            startedAt: new Date('2026-06-01T11:00:00.000Z'),
          }),
          makeUrl('https://c.test', UrlStatus.Completed, {
            httpStatus: 200,
            startedAt: now,
            endedAt: now,
          }),
        ],
      });

      cancelPendingUrls(job, now);

      expect(job.urls[0].status).toBe(JobStatus.Cancelled);
      expect(job.urls[0].endedAt).toEqual(now);
      expect(job.urls[1].status).toBe(JobStatus.InProgress);
      expect(job.urls[2].status).toBe(JobStatus.Completed);
    });
  });

  describe('countUrlStatuses', () => {
    it('counts each status', () => {
      const counts = countUrlStatuses([
        makeUrl('https://a.test', UrlStatus.Pending),
        makeUrl('https://b.test', UrlStatus.Pending),
        makeUrl('https://c.test', UrlStatus.Completed),
        makeUrl('https://d.test', UrlStatus.Failed),
        makeUrl('https://e.test', UrlStatus.Cancelled),
        makeUrl('https://f.test', UrlStatus.InProgress),
      ]);

      expect(counts).toEqual({
        pending: 2,
        in_progress: 1,
        completed: 1,
        failed: 1,
        cancelled: 1,
      });
    });
  });

  describe('resolveJobStatusFromUrls', () => {
    it('returns cancelled when forceCancelled', () => {
      expect(
        resolveJobStatusFromUrls(
          [makeUrl('https://a.test', UrlStatus.Completed)],
          { forceCancelled: true },
        ),
      ).toBe(JobStatus.Cancelled);
    });

    it('returns failed when all URLs failed', () => {
      expect(
        resolveJobStatusFromUrls([
          makeUrl('https://a.test', UrlStatus.Failed),
          makeUrl('https://b.test', UrlStatus.Failed),
        ]),
      ).toBe(JobStatus.Failed);
    });

    it('returns cancelled when any cancelled and all terminal', () => {
      expect(
        resolveJobStatusFromUrls([
          makeUrl('https://a.test', UrlStatus.Completed),
          makeUrl('https://b.test', UrlStatus.Cancelled),
        ]),
      ).toBe(JobStatus.Cancelled);
    });

    it('returns completed when no failures/cancels left pending', () => {
      expect(
        resolveJobStatusFromUrls([
          makeUrl('https://a.test', UrlStatus.Completed),
          makeUrl('https://b.test', UrlStatus.Completed),
        ]),
      ).toBe(JobStatus.Completed);
    });
  });

  describe('job status helpers', () => {
    it('isTerminalJobStatus / canCancelJob', () => {
      expect(isTerminalJobStatus(JobStatus.Completed)).toBe(true);
      expect(isTerminalJobStatus(JobStatus.Failed)).toBe(true);
      expect(isTerminalJobStatus(JobStatus.Cancelled)).toBe(true);
      expect(isTerminalJobStatus(JobStatus.Pending)).toBe(false);
      expect(isTerminalJobStatus(JobStatus.InProgress)).toBe(false);

      expect(canCancelJob(JobStatus.Pending)).toBe(true);
      expect(canCancelJob(JobStatus.InProgress)).toBe(true);
      expect(canCancelJob(JobStatus.Completed)).toBe(false);
    });
  });
});
