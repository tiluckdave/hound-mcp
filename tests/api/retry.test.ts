import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry, getRetryDelay } from "../../src/api/retry.js";

function mockResponse(status: number, retryAfter?: string) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name: string) {
        return name.toLowerCase() === "retry-after" ? (retryAfter ?? null) : null;
      },
    },
    text: async () => "",
    json: async () => ({}),
  };
}

describe("getRetryDelay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses numeric Retry-After headers", () => {
    expect(getRetryDelay(mockResponse(429, "2"), 100)).toBe(2000);
  });

  it("parses HTTP-date Retry-After headers", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-01T00:00:00.000Z"));

    expect(getRetryDelay(mockResponse(429, "Thu, 01 Jan 2026 00:00:03 GMT"), 100)).toBe(3000);
  });

  it("caps the delay at five seconds", () => {
    expect(getRetryDelay(mockResponse(429, "120"), 100)).toBe(5000);
  });

  it("falls back when there is no Retry-After header", () => {
    expect(getRetryDelay(mockResponse(503), 100)).toBe(100);
  });
});

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries and eventually succeeds", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse(503) as never)
      .mockResolvedValueOnce(mockResponse(200) as never);

    const response = await fetchWithRetry("https://example.com");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the final response after exhausting retries", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse(503) as never);

    const response = await fetchWithRetry("https://example.com");

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
