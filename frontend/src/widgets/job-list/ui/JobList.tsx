import { useEffect } from 'react';
import {
  fetchJobDetails,
  fetchJobs,
  setActiveJobId,
} from '@/entities/job';
import {
  selectActiveJobId,
  selectJobsList,
  selectListError,
  selectListStatus,
} from '@/entities/job/model/selectors';
import { RequestStatus } from '@/entities/job/model/types';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { ErrorBanner } from '@/shared/ui/ErrorBanner/ErrorBanner';
import { Spinner } from '@/shared/ui/Spinner/Spinner';
import { Button } from '@/shared/ui/Button/Button';
import { JobListItem } from './JobListItem';
import styles from './JobList.module.css';

export function JobList() {
  const dispatch = useAppDispatch();
  const list = useAppSelector(selectJobsList);
  const status = useAppSelector(selectListStatus);
  const error = useAppSelector(selectListError);
  const activeId = useAppSelector(selectActiveJobId);

  useEffect(() => {
    void dispatch(fetchJobs());
  }, [dispatch]);

  const onSelect = (id: number) => {
    dispatch(setActiveJobId(id));
    void dispatch(fetchJobDetails(id));
  };

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>Jobs</h2>
        <Button
          variant="ghost"
          onClick={() => void dispatch(fetchJobs())}
          disabled={status === RequestStatus.Loading}
        >
          Refresh
        </Button>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      {status === RequestStatus.Loading && list.length === 0 ? (
        <Spinner label="Loading jobs…" />
      ) : null}

      {status === RequestStatus.Succeeded && list.length === 0 ? (
        <p className={styles.empty}>No jobs yet. Create one on the left.</p>
      ) : null}

      <ul className={styles.list}>
        {list.map((job) => (
          <li key={job.id}>
            <JobListItem
              job={job}
              active={job.id === activeId}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
