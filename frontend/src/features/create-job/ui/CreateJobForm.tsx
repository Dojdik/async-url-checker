import { useState, type FormEvent } from 'react';
import { createJob, clearCreateError } from '@/entities/job';
import {
  selectCreateError,
  selectCreateStatus,
} from '@/entities/job/model/selectors';
import { RequestStatus } from '@/entities/job/model/types';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button/Button';
import { ErrorBanner } from '@/shared/ui/ErrorBanner/ErrorBanner';
import { Spinner } from '@/shared/ui/Spinner/Spinner';
import styles from './CreateJobForm.module.css';

function parseUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CreateJobForm() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectCreateStatus);
  const error = useAppSelector(selectCreateError);
  const [text, setText] = useState('https://example.com\nhttps://httpbin.org/status/404');

  const loading = status === RequestStatus.Loading;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const urls = parseUrls(text);
    if (urls.length === 0) {
      return;
    }
    void dispatch(createJob(urls));
  };

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <header className={styles.header}>
        <h2 className={styles.title}>New job</h2>
        <p className={styles.hint}>
          One URL per line (or comma-separated). Backend runs HEAD checks with
          concurrency limits.
        </p>
      </header>

      <label className={styles.label} htmlFor="urls">
        URLs
      </label>
      <textarea
        id="urls"
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="https://example.com"
        disabled={loading}
      />

      {error ? (
        <ErrorBanner
          message={error}
          onDismiss={() => dispatch(clearCreateError())}
        />
      ) : null}

      <div className={styles.actions}>
        {loading ? <Spinner label="Creating…" /> : null}
        <Button type="submit" disabled={loading || parseUrls(text).length === 0}>
          Start check
        </Button>
      </div>
    </form>
  );
}
