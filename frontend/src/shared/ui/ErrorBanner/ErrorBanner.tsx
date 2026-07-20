import styles from './ErrorBanner.module.css';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className={styles.banner} role="alert">
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className={styles.dismiss} onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
