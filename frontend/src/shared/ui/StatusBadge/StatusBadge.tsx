import {
  ApiUrlStatus,
  JobStatus,
  type ApiUrlStatus as ApiUrlStatusType,
  type JobStatus as JobStatusType,
} from '@/entities/job/model/types';
import styles from './StatusBadge.module.css';

type Status = JobStatusType | ApiUrlStatusType;

const LABELS: Record<Status, string> = {
  [JobStatus.Pending]: 'Pending',
  [JobStatus.InProgress]: 'In progress',
  [JobStatus.Completed]: 'Completed',
  [JobStatus.Cancelled]: 'Cancelled',
  [JobStatus.Failed]: 'Failed',
  [ApiUrlStatus.Success]: 'Success',
  [ApiUrlStatus.Error]: 'Error',
};

export function StatusBadge({ status }: { status: Status }) {
  const tone = status.replace('_', '-');
  return (
    <span className={`${styles.badge} ${styles[tone] ?? ''}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
