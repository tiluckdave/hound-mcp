import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry, getRetryDelay } from "../../src/api/retry.js";

function mockResponse(status: number, retryAfter?: string) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name: string) {
        if (name.toLowerCase() === "retry-after") {
          return retryAfter ?? null;
        }

        return null;
      },
    },
    text: async () => "",
    json: async () => ({}),
  };
}

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    try {
      await vi.runOnlyPendingTimersAsync();
    } catch {
      // no pending timers
    }

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("retries and eventually succeeds", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse(503) as never)
      .mockResolvedValueOnce(mockResponse(200) as never);

    const promise = fetchWithRetry("https://example.com");

    await vi.advanceTimersByTimeAsync(100);

    const response = await promise;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns final response after exhausting retries", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse(503) as never)
      .mockResolvedValueOnce(mockResponse(503) as never)
      .mockResolvedValueOnce(mockResponse(503) as never);

    const promise = fetchWithRetry("https://example.com");

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(400);

    const response = await promise;

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("parses numeric Retry-After headers", () => {
    const response = mockResponse(429, "2");

    expect(getRetryDelay(response, 100)).toBe(2000);
  });

  it("parses HTTP-date Retry-After headers", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const response = mockResponse(429, "Thu, 01 Jan 2026 00:00:03 GMT");

    expect(getRetryDelay(response, 100)).toBe(3000);
  });

  it("caps Retry-After delays to five seconds", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse(429, "120") as never)
      .mockResolvedValueOnce(mockResponse(200) as never);

    const promise = fetchWithRetry("https://example.com");

    await vi.advanceTimersByTimeAsync(5000);

    const response = await promise;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable responses", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse(400) as never);

    const response = await fetchWithRetry("https://example.com");

    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
