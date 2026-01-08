/**
 * Configuration for generation state recovery and polling
 */
export const GENERATION_RECOVERY_CONFIG = {
  /** Polling interval in milliseconds */
  POLL_INTERVAL_MS: 5000,

  /** Maximum number of polling retries before giving up */
  MAX_RETRIES: 12,

  /** Maximum total polling duration in milliseconds (5 minutes) */
  MAX_POLL_DURATION_MS: 5 * 60 * 1000,
} as const;
