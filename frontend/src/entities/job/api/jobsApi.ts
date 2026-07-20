import { apiRequest } from '@/shared/api/baseClient';
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
  list(offset = 0, count = 100): Promise<JobListItem[]> {
    const q = new URLSearchParams({
      offset: String(offset),
      count: String(count),
    });
    return apiRequest<JobListItem[]>(`/jobs?${q.toString()}`);
  },

  getById(id: number): Promise<JobDetail> {
    return apiRequest<JobDetail>(`/jobs/${id}`);
  },

  create(urls: string[]): Promise<JobCreated> {
    return apiRequest<JobCreated>('/jobs', {
      method: 'POST',
      body: JSON.stringify({ urls }),
    });
  },

  cancel(id: number): Promise<JobDetail> {
    return apiRequest<JobDetail>(`/jobs/${id}`, {
      method: 'DELETE',
    });
  },
};
