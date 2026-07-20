import type { RootState } from '@/app/store';
import { isJobActive } from '@/entities/job/model/types';

export const selectJobsList = (state: RootState) => state.jobs.list;
export const selectListStatus = (state: RootState) => state.jobs.listStatus;
export const selectListError = (state: RootState) => state.jobs.listError;

export const selectActiveJobId = (state: RootState) => state.jobs.activeJobId;
export const selectJobDetails = (state: RootState) => state.jobs.details;
export const selectDetailsStatus = (state: RootState) =>
  state.jobs.detailsStatus;
export const selectDetailsError = (state: RootState) => state.jobs.detailsError;

export const selectCreateStatus = (state: RootState) => state.jobs.createStatus;
export const selectCreateError = (state: RootState) => state.jobs.createError;

export const selectCancelStatus = (state: RootState) => state.jobs.cancelStatus;
export const selectCancelError = (state: RootState) => state.jobs.cancelError;

export const selectActiveJobIsRunning = (state: RootState) => {
  const details = state.jobs.details;
  return details ? isJobActive(details.status) : false;
};
