/**
 * Generic retry wrapper with exponential backoff for transient network errors.
 * Non-transient errors (auth, RLS, constraints) are thrown immediately.
 */

const TRANSIENT_PATTERNS = [
  "failed to fetch",
  "networkerror",
  "network request failed",
  "timeout",
  "econnreset",
  "econnrefused",
  "load failed",
  "aborted",
];

function isTransientError(error: unknown): boolean {
  const message =
    (error instanceof Error ? error.message : String(error)).toLowerCase();
  return TRANSIENT_PATTERNS.some((p) => message.includes(p));
}

export async function retryAsync<T>(
  fn: () => Promise<T>,
  {
    maxRetries = 3,
    isRetryable = isTransientError,
  }: { maxRetries?: number; isRetryable?: (err: unknown) => boolean } = {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries || !isRetryable(err)) {
        throw err;
      }

      // Exponential backoff: ~1s, ~2s, ~4s with jitter
      const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
      console.warn(
        `[retryAsync] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay)}ms…`,
        err instanceof Error ? err.message : err,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
