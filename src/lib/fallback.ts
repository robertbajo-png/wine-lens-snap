const DEFAULT_TIMEOUT_MS = 900;

type FallbackOptions = {
  timeoutMs?: number;
  context?: string;
};

export const withTimeoutFallback = async <T>(
  operation: () => Promise<T>,
  fallback: () => T,
  options: FallbackOptions = {},
): Promise<T> => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, context = "operation" } = options;

  const setTimer = typeof window !== "undefined" ? window.setTimeout : setTimeout;
  const clearTimer = typeof window !== "undefined" ? window.clearTimeout : clearTimeout;

  return new Promise<T>((resolve) => {
    const timer = setTimer(() => {
      console.warn(`[fallback] ${context} timed out after ${timeoutMs}ms`);
      resolve(fallback());
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimer(timer);
        resolve(result);
      })
      .catch((error) => {
        console.warn(`[fallback] ${context} failed`, error);
        clearTimer(timer);
        resolve(fallback());
      });
  });
};
