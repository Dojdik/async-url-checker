import { configureStore } from '@reduxjs/toolkit';
import { jobsReducer } from '@/entities/job';

export const store = configureStore({
  reducer: {
    jobs: jobsReducer,
  },
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
