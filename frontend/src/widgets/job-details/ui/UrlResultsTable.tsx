import type { JobUrlDetail } from '@/entities/job/model/types';
import { StatusBadge } from '@/shared/ui/StatusBadge/StatusBadge';
import { formatDateTime, formatDurationMs } from '@/shared/lib/format';
import styles from './UrlResultsTable.module.css';

export function UrlResultsTable({ urls }: { urls: JobUrlDetail[] }) {
  if (urls.length === 0) {
    return <p className={styles.empty}>No URLs in this job.</p>;
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>URL</th>
            <th>Status</th>
            <th>HTTP</th>
            <th>Error</th>
            <th>Started</th>
            <th>Ended</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {urls.map((row) => (
            <tr key={row.url}>
              <td className={styles.url} title={row.url}>
                {row.url}
              </td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td className={styles.mono}>{row.httpStatus ?? '—'}</td>
              <td className={styles.error} title={row.error}>
                {row.error ?? '—'}
              </td>
              <td className={styles.time}>{formatDateTime(row.startedAt)}</td>
              <td className={styles.time}>{formatDateTime(row.endedAt)}</td>
              <td className={styles.mono}>
                {formatDurationMs(row.durationMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
