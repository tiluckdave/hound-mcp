interface RetryResponse {
  status: number;
  ok: boolean;
  headers?: {
    get(name: string): string | null;
  };
  text(): Promise<string>;
  json(): Promise<unknown>;
}

// Cap any single retry wait so a hostile/overloaded server's large Retry-After
// can't freeze the tool for minutes (it runs as a local agent tool).
const MAX_RETRY_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export function getRetryDelay(response: RetryResponse, fallbackDelay: number): number {
  const cap = (ms: number) => Math.min(ms, MAX_RETRY_DELAY_MS);
  const retryAfter = response.headers?.get("Retry-After");

  if (!retryAfter) {
    return cap(fallbackDelay);
  }

  const seconds = Number(retryAfter);

  if (!Number.isNaN(seconds)) {
    return cap(seconds * 1000);
  }

  const retryDate = Date.parse(retryAfter);

  if (!Number.isNaN(retryDate)) {
    return cap(Math.max(0, retryDate - Date.now()));
  }

  return cap(fallbackDelay);
}

export async function fetchWithRetry(url: string, options?: unknown): Promise<RetryResponse> {
  const delays = [100, 400];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const response = await globalThis.fetch(url, options as RequestInit | undefined);

    if (![429, 503].includes(response.status)) {
      return response;
    }

    if (attempt === delays.length) {
      return response;
    }

    const fallbackDelay = delays[attempt] ?? 400;

    await sleep(getRetryDelay(response, fallbackDelay));
  }

  throw new Error("Unexpected retry failure");
}
