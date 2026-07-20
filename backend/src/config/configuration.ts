/**
 * Central place for all environment variables.
 *
 * | Env                      | Config key              | Default | Description                          |
 * |--------------------------|-------------------------|---------|--------------------------------------|
 * | PORT                     | port                    | 3001    | HTTP port (master only)              |
 * | WORKERS_COUNT            | workersCount            | 2       | Cluster worker processes             |
 * | HTTP_TIMEOUT_MS          | httpTimeoutMs           | 10000   | HEAD request timeout                 |
 * | MAX_CONCURRENT_URLS      | maxConcurrentUrls       | 5       | Parallel HEAD requests per job       |
 * | URL_DELAY_MAX_SECONDS    | urlDelayMaxSeconds      | 10      | Max artificial delay after HEAD (s)  |
 * | JOB_TIMEOUT_BASE_MS      | jobTimeoutBaseMs        | 60000   | Min wall-clock budget per job        |
 * | JOB_TIMEOUT_PER_URL_MS   | jobTimeoutPerUrlMs      | 12000   | Extra budget per URL in a job        |
 *
 * Job assign timeout = max(jobTimeoutBaseMs, urls.length * jobTimeoutPerUrlMs)
 *
 * Copy `.env.example` → `.env` to override. Loaded by Nest ConfigModule.
 */

export interface AppConfiguration {
  /** HTTP listen port (master process). Env: PORT */
  port: number;
  /** Number of Node cluster workers. Env: WORKERS_COUNT */
  workersCount: number;
  /** Abort HEAD after this many ms. Env: HTTP_TIMEOUT_MS */
  httpTimeoutMs: number;
  /** Max concurrent URL checks within one job. Env: MAX_CONCURRENT_URLS */
  maxConcurrentUrls: number;
  /** Random delay ceiling in seconds after HEAD. Env: URL_DELAY_MAX_SECONDS */
  urlDelayMaxSeconds: number;
  /** Minimum job wall-clock timeout (ms). Env: JOB_TIMEOUT_BASE_MS */
  jobTimeoutBaseMs: number;
  /** Per-URL addition to job timeout (ms). Env: JOB_TIMEOUT_PER_URL_MS */
  jobTimeoutPerUrlMs: number;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function assertRange(
  key: keyof AppConfiguration,
  value: number,
  min: number,
  max: number,
  envName: string,
): void {
  if (value < min || value > max) {
    throw new Error(
      `Invalid ${envName} (${key}=${value}): expected ${min}–${max}`,
    );
  }
}

/** Nest ConfigModule `load` factory — single source of truth for env defaults. */
export function loadConfiguration(): AppConfiguration {
  const config: AppConfiguration = {
    port: intEnv('PORT', 3001),
    workersCount: intEnv('WORKERS_COUNT', 16),
    httpTimeoutMs: intEnv('HTTP_TIMEOUT_MS', 10_000),
    maxConcurrentUrls: intEnv('MAX_CONCURRENT_URLS', 5),
    urlDelayMaxSeconds: intEnv('URL_DELAY_MAX_SECONDS', 10),
    jobTimeoutBaseMs: intEnv('JOB_TIMEOUT_BASE_MS', 60_000),
    jobTimeoutPerUrlMs: intEnv('JOB_TIMEOUT_PER_URL_MS', 12_000),
  };

  assertRange('port', config.port, 1, 65535, 'PORT');
  assertRange('workersCount', config.workersCount, 1, 64, 'WORKERS_COUNT');
  assertRange('httpTimeoutMs', config.httpTimeoutMs, 100, 300_000, 'HTTP_TIMEOUT_MS');
  assertRange(
    'maxConcurrentUrls',
    config.maxConcurrentUrls,
    1,
    100,
    'MAX_CONCURRENT_URLS',
  );
  assertRange(
    'urlDelayMaxSeconds',
    config.urlDelayMaxSeconds,
    0,
    120,
    'URL_DELAY_MAX_SECONDS',
  );
  assertRange(
    'jobTimeoutBaseMs',
    config.jobTimeoutBaseMs,
    1_000,
    3_600_000,
    'JOB_TIMEOUT_BASE_MS',
  );
  assertRange(
    'jobTimeoutPerUrlMs',
    config.jobTimeoutPerUrlMs,
    100,
    600_000,
    'JOB_TIMEOUT_PER_URL_MS',
  );

  return config;
}

/** Wall-clock budget for a job on a worker. */
export function computeJobTimeoutMs(
  urlCount: number,
  baseMs: number,
  perUrlMs: number,
): number {
  return Math.max(baseMs, urlCount * perUrlMs);
}
