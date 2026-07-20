import type { ApiUrlStatus, JobStatus } from '@/entities/job/model/types';
import styles from './StatusBadge.module.css';

type Status = JobStatus | ApiUrlStatus;

const LABELS: Record<Status, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
  success: 'Success',
  error: 'Error',
};

export function StatusBadge({ status }: { status: Status }) {
  const tone = status.replace('_', '-');
  return (
    <span className={`${styles.badge} ${styles[tone] ?? ''}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
