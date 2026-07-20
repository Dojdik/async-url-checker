/** API path fragments (relative to API base, e.g. /api). */
export const ApiRoutes = {
  jobs: '/jobs',
  job: (id: number) => `/jobs/${id}`,
} as const;

export const API_BASE_DEFAULT = '/api';

export const DEFAULT_JOBS_PAGE_SIZE = 100;
