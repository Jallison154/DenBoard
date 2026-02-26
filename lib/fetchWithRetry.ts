import { logger } from "./logging";

export type FetchRetryOptions = {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: FetchRetryOptions
): Promise<Response> {
  const retries = options?.retries ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 1500;
  const timeoutMs = options?.timeoutMs ?? 8000;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt > retries) {
        logger.error("fetchWithRetry: giving up", {
          url,
          attempts: attempt,
          error: String(err)
        });
        throw err;
      }
      logger.warn("fetchWithRetry: retrying request", {
        url,
        attempt,
        error: String(err)
      });
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

