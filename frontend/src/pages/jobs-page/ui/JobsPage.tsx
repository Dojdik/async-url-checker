import { CreateJobForm } from '@/features/create-job/ui/CreateJobForm';
import { JobList } from '@/widgets/job-list/ui/JobList';
import { JobDetails } from '@/widgets/job-details/ui/JobDetails';
import styles from './JobsPage.module.css';

/**
 * Page composition — wires features + widgets (FSD pages layer).
 */
export function JobsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.heading}>Async URL Checker</h1>
          <p className={styles.sub}>
            Create jobs, monitor progress, inspect per-URL HEAD results.
          </p>
        </div>
      </header>

      <div className={styles.grid}>
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <CreateJobForm />
          </div>
          <div className={styles.card}>
            <JobList />
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.card}>
            <JobDetails />
          </div>
        </main>
      </div>
    </div>
  );
}
