/**
 * Retry utility for handling transient failures
 */

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  shouldRetry: (error) => {
    // Retry on network errors or 5xx server errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('network') || message.includes('timeout')) {
        return true;
      }
    }

    // Check for axios error with response
    const axiosError = error as { response?: { status: number } };
    if (axiosError.response?.status) {
      const status = axiosError.response.status;
      // Retry on 5xx errors and 429 (rate limit)
      return status >= 500 || status === 429;
    }

    return false;
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.delayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt or shouldn't retry
      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }

      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= opts.backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Create a retryable version of an async function
 */
export function retryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: unknown[]) => withRetry(() => fn(...args), options)) as T;
}
