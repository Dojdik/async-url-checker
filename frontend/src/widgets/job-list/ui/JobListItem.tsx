import type { JobListItem as JobListItemType } from '@/entities/job/model/types';
import { StatusBadge } from '@/shared/ui/StatusBadge/StatusBadge';
import { formatDateTime } from '@/shared/lib/format';
import styles from './JobListItem.module.css';

interface JobListItemProps {
  job: JobListItemType;
  active: boolean;
  onSelect: (id: number) => void;
}

export function JobListItem({ job, active, onSelect }: JobListItemProps) {
  return (
    <button
      type="button"
      className={`${styles.item} ${active ? styles.active : ''}`}
      onClick={() => onSelect(job.id)}
    >
      <div className={styles.row}>
        <span className={styles.id}>#{job.id}</span>
        <StatusBadge status={job.status} />
      </div>
      <div className={styles.meta}>{formatDateTime(job.createdAt)}</div>
      <div className={styles.stats}>
        <span>{job.urlsCount} URLs</span>
        <span className={styles.ok}>✓ {job.stats.succeeded}</span>
        <span className={styles.err}>✕ {job.stats.failed}</span>
      </div>
    </button>
  );
}
