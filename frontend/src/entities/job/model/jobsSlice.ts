import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import { jobsApi } from '@/entities/job/api/jobsApi';
import {
  RequestStatus,
  type JobDetail,
  type JobListItem,
  type RequestStatus as RequestStatusType,
} from '@/entities/job/model/types';
import { ApiError } from '@/shared/api/baseClient';

export interface JobsState {
  /** Global job list */
  list: JobListItem[];
  listStatus: RequestStatusType;
  listError: string | null;

  /** Selected / active job id */
  activeJobId: number | null;

  /** Detailed view for active job */
  details: JobDetail | null;
  detailsStatus: RequestStatusType;
  detailsError: string | null;

  createStatus: RequestStatusType;
  createError: string | null;

  cancelStatus: RequestStatusType;
  cancelError: string | null;
}

const initialState: JobsState = {
  list: [],
  listStatus: RequestStatus.Idle,
  listError: null,
  activeJobId: null,
  details: null,
  detailsStatus: RequestStatus.Idle,
  detailsError: null,
  createStatus: RequestStatus.Idle,
  createError: null,
  cancelStatus: RequestStatus.Idle,
  cancelError: null,
};

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

export const fetchJobs = createAsyncThunk(
  'jobs/fetchList',
  async (_, { rejectWithValue }) => {
    try {
      return await jobsApi.list();
    } catch (error) {
      return rejectWithValue(toErrorMessage(error));
    }
  },
);

export const fetchJobDetails = createAsyncThunk(
  'jobs/fetchDetails',
  async (id: number, { rejectWithValue }) => {
    try {
      return await jobsApi.getById(id);
    } catch (error) {
      return rejectWithValue(toErrorMessage(error));
    }
  },
);

export const createJob = createAsyncThunk(
  'jobs/create',
  async (urls: string[], { rejectWithValue, dispatch }) => {
    try {
      const created = await jobsApi.create(urls);
      await dispatch(fetchJobs());
      await dispatch(fetchJobDetails(created.id));
      return created;
    } catch (error) {
      return rejectWithValue(toErrorMessage(error));
    }
  },
);

export const cancelJob = createAsyncThunk(
  'jobs/cancel',
  async (id: number, { rejectWithValue, dispatch }) => {
    try {
      const detail = await jobsApi.cancel(id);
      await dispatch(fetchJobs());
      return detail;
    } catch (error) {
      return rejectWithValue(toErrorMessage(error));
    }
  },
);

const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    setActiveJobId(state, action: PayloadAction<number | null>) {
      state.activeJobId = action.payload;
      if (action.payload === null) {
        state.details = null;
        state.detailsStatus = RequestStatus.Idle;
        state.detailsError = null;
      }
    },
    clearCreateError(state) {
      state.createError = null;
      state.createStatus = RequestStatus.Idle;
    },
    clearErrors(state) {
      state.listError = null;
      state.detailsError = null;
      state.createError = null;
      state.cancelError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobs.pending, (state) => {
        state.listStatus = RequestStatus.Loading;
        state.listError = null;
      })
      .addCase(fetchJobs.fulfilled, (state, action) => {
        state.listStatus = RequestStatus.Succeeded;
        state.list = action.payload;
      })
      .addCase(fetchJobs.rejected, (state, action) => {
        state.listStatus = RequestStatus.Failed;
        state.listError = (action.payload as string) ?? 'Failed to load jobs';
      })

      .addCase(fetchJobDetails.pending, (state) => {
        state.detailsStatus = RequestStatus.Loading;
        state.detailsError = null;
      })
      .addCase(fetchJobDetails.fulfilled, (state, action) => {
        state.detailsStatus = RequestStatus.Succeeded;
        state.details = action.payload;
        state.activeJobId = action.payload.id;
      })
      .addCase(fetchJobDetails.rejected, (state, action) => {
        state.detailsStatus = RequestStatus.Failed;
        state.detailsError =
          (action.payload as string) ?? 'Failed to load job details';
      })

      .addCase(createJob.pending, (state) => {
        state.createStatus = RequestStatus.Loading;
        state.createError = null;
      })
      .addCase(createJob.fulfilled, (state, action) => {
        state.createStatus = RequestStatus.Succeeded;
        state.activeJobId = action.payload.id;
      })
      .addCase(createJob.rejected, (state, action) => {
        state.createStatus = RequestStatus.Failed;
        state.createError =
          (action.payload as string) ?? 'Failed to create job';
      })

      .addCase(cancelJob.pending, (state) => {
        state.cancelStatus = RequestStatus.Loading;
        state.cancelError = null;
      })
      .addCase(cancelJob.fulfilled, (state, action) => {
        state.cancelStatus = RequestStatus.Succeeded;
        state.details = action.payload;
        state.activeJobId = action.payload.id;
      })
      .addCase(cancelJob.rejected, (state, action) => {
        state.cancelStatus = RequestStatus.Failed;
        state.cancelError =
          (action.payload as string) ?? 'Failed to cancel job';
      });
  },
});

export const { setActiveJobId, clearCreateError, clearErrors } =
  jobsSlice.actions;
export const jobsReducer = jobsSlice.reducer;
