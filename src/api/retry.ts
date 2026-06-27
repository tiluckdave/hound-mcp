interface RetryResponse {
  status: number;
  ok: boolean;
  headers?: {
    get(name: string): string | null;
  };
  text(): Promise<string>;
  json(): Promise<unknown>;
}

declare const fetch: (url: string, options?: unknown) => Promise<RetryResponse>;

declare function setTimeout(handler: () => void, timeout: number): unknown;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function getRetryDelay(response: RetryResponse, fallbackDelay: number): number {
  const retryAfter = response.headers?.get("Retry-After");

  if (!retryAfter) {
    return fallbackDelay;
  }

  const seconds = Number(retryAfter);

  if (!Number.isNaN(seconds)) {
    return seconds * 1000;
  }

  const retryDate = Date.parse(retryAfter);

  if (!Number.isNaN(retryDate)) {
    return Math.max(0, retryDate - Date.now());
  }

  return fallbackDelay;
}

export async function fetchWithRetry(url: string, options?: unknown): Promise<RetryResponse> {
  const delays = [100, 400];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const response = await fetch(url, options);

    if (![429, 503].includes(response.status)) {
      return response;
    }

    if (attempt === delays.length) {
      return response;
    }

    const fallbackDelay = delays[attempt] ?? 400;

    const delay = Math.min(getRetryDelay(response, fallbackDelay), 5000);

    await sleep(delay);
  }

  throw new Error("Unexpected retry failure");
}
