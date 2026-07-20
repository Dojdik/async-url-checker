import { apiRequest } from '@/shared/api/baseClient';
import { ApiRoutes, DEFAULT_JOBS_PAGE_SIZE } from '@/shared/api/routes';
import type {
  JobCreated,
  JobDetail,
  JobListItem,
} from '@/entities/job/model/types';

/**
 * Jobs API port — single place for backend HTTP (SRP).
 * UI and Redux depend on this module, not on fetch.
 */
export const jobsApi = {
  list(offset = 0, count = DEFAULT_JOBS_PAGE_SIZE): Promise<JobListItem[]> {
    const q = new URLSearchParams({
      offset: String(offset),
      count: String(count),
    });
    return apiRequest<JobListItem[]>(`${ApiRoutes.jobs}?${q.toString()}`);
  },

  getById(id: number): Promise<JobDetail> {
    return apiRequest<JobDetail>(ApiRoutes.job(id));
  },

  create(urls: string[]): Promise<JobCreated> {
    return apiRequest<JobCreated>(ApiRoutes.jobs, {
      method: 'POST',
      body: JSON.stringify({ urls }),
    });
  },

  cancel(id: number): Promise<JobDetail> {
    return apiRequest<JobDetail>(ApiRoutes.job(id), {
      method: 'DELETE',
    });
  },
};
