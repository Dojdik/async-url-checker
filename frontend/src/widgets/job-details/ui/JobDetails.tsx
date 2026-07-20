import { useEffect } from 'react';
import { fetchJobDetails, isJobActive } from '@/entities/job';
import {
  selectActiveJobId,
  selectDetailsError,
  selectDetailsStatus,
  selectJobDetails,
} from '@/entities/job/model/selectors';
import { CancelJobButton } from '@/features/cancel-job/ui/CancelJobButton';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { formatDateTime } from '@/shared/lib/format';
import { ErrorBanner } from '@/shared/ui/ErrorBanner/ErrorBanner';
import { Spinner } from '@/shared/ui/Spinner/Spinner';
import { StatusBadge } from '@/shared/ui/StatusBadge/StatusBadge';
import { UrlResultsTable } from './UrlResultsTable';
import { RequestStatus } from '@/entities/job/model/types';
import { JOB_DETAILS_POLL_MS } from '@/shared/config/ui';
import styles from './JobDetails.module.css';

export function JobDetails() {
  const dispatch = useAppDispatch();
  const activeId = useAppSelector(selectActiveJobId);
  const details = useAppSelector(selectJobDetails);
  const status = useAppSelector(selectDetailsStatus);
  const error = useAppSelector(selectDetailsError);

  // Poll active job while it is running
  useEffect(() => {
    if (!activeId || !details || !isJobActive(details.status)) {
      return;
    }
    const timer = window.setInterval(() => {
      void dispatch(fetchJobDetails(activeId));
    }, JOB_DETAILS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [activeId, details?.status, details?.id, dispatch]);

  if (!activeId) {
    return (
      <section className={styles.section}>
        <p className={styles.placeholder}>
          Select a job from the list or create a new one.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>
            Job #{activeId}
            {details ? (
              <span className={styles.badge}>
                <StatusBadge status={details.status} />
              </span>
            ) : null}
          </h2>
          {details ? (
            <p className={styles.meta}>
              Created {formatDateTime(details.createdAt)} · Updated{' '}
              {formatDateTime(details.updatedAt)}
            </p>
          ) : null}
        </div>
        <CancelJobButton />
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      {status === RequestStatus.Loading && !details ? (
        <Spinner label="Loading details…" />
      ) : null}

      {details ? <UrlResultsTable urls={details.urls} /> : null}

      {status === RequestStatus.Loading && details ? (
        <div className={styles.poll}>
          <Spinner label="Refreshing…" />
        </div>
      ) : null}
    </section>
  );
}
