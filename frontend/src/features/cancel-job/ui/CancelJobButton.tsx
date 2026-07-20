import { cancelJob, isJobActive } from '@/entities/job';
import {
  selectCancelError,
  selectCancelStatus,
  selectJobDetails,
} from '@/entities/job/model/selectors';
import { RequestStatus } from '@/entities/job/model/types';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button/Button';
import { ErrorBanner } from '@/shared/ui/ErrorBanner/ErrorBanner';
import styles from './CancelJobButton.module.css';

export function CancelJobButton() {
  const dispatch = useAppDispatch();
  const details = useAppSelector(selectJobDetails);
  const status = useAppSelector(selectCancelStatus);
  const error = useAppSelector(selectCancelError);

  if (!details || !isJobActive(details.status)) {
    return error ? (
      <div className={styles.wrap}>
        <ErrorBanner message={error} />
      </div>
    ) : null;
  }

  const loading = status === RequestStatus.Loading;

  return (
    <div className={styles.wrap}>
      {error ? <ErrorBanner message={error} /> : null}
      <Button
        variant="danger"
        disabled={loading}
        onClick={() => void dispatch(cancelJob(details.id))}
      >
        {loading ? 'Cancelling…' : 'Cancel job'}
      </Button>
    </div>
  );
}
