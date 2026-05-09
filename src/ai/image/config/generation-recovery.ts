/**
 * Default generation lease window — 5 minutes (Week 4.1).
 *
 * When a message is created with status='generating' the server stamps
 * generationLeaseExpiresAt = now() + this window. Request-triggered recovery
 * finds messages whose lease has elapsed, marks them failed, and releases the
 * associated credit hold when the user opens a project, polls status, or starts
 * another generation.
 *
 * Tradeoff: too short and slow Gemini calls get reaped while still alive;
 * too long and a crashed client leaves credits locked for too long.
 * Gemini's 95th-percentile generation time is ~90s, so 5 minutes gives
 * 3x headroom while keeping the UX impact of a true crash bounded.
 *
 * Lives here (not in a 'use server' module) because Next.js requires that
 * 'use server' files only export async functions.
 */
export const GENERATION_LEASE_DURATION_MS = 5 * 60 * 1000;

/**
 * Configuration for generation state recovery and polling
 */
export const GENERATION_RECOVERY_CONFIG = {
  /** Polling interval in milliseconds */
  POLL_INTERVAL_MS: 5000,

  /** Maximum number of polling retries before giving up */
  MAX_RETRIES: 12,

  /**
   * Tolerance for "message not found" responses before concluding the
   * message is truly gone. Multi-tab usage and replica lag can briefly
   * surface a not-found while a write is propagating, so we wait for a
   * sustained absence rather than failing on the first miss. Smaller than
   * MAX_RETRIES because a missing record is a stronger signal than a
   * generic network error.
   */
  MAX_NOT_FOUND_RETRIES: 3,

  /** Maximum total polling duration in milliseconds (5 minutes) */
  MAX_POLL_DURATION_MS: 5 * 60 * 1000,
} as const;
