export function formatDateTime(value?: string): string {
  if (!value) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatDurationMs(ms?: number): string {
  if (ms === undefined || ms === null) {
    return '—';
  }
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(1)} s`;
}
