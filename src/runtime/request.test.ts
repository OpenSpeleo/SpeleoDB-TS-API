import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient, apiRequest } from "./request";
import type { ApiOperationMetadata, ApiTransportRequest } from "./types";

const operation: ApiOperationMetadata = {
  operationId: "test",
  responses: {
    "200": { content: { "application/json": "json" } },
    "204": { content: {} },
    "400": { content: { "application/json": "json" } },
  },
};
const jsonHeaders = () => new Headers({ "content-type": "application/json" });
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("request boundary", () => {
  it.each([
    "ftp://example.test",
    "https://user:secret@example.test",
    "https://:secret@example.test",
    "https://example.test/api/",
    "https://example.test/?query=value",
    "https://example.test/#fragment",
    "/relative",
  ])("rejects a non-origin API base URL: %s", (baseUrl) => {
    expect(() => createApiClient({ baseUrl })).toThrow(TypeError);
  });

  it("normalizes and freezes client configuration without mutating supplied headers", async () => {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Owner": "client",
    });
    const transport = vi.fn(async () => ({
      status: 204,
      data: undefined,
      headers: new Headers(),
    }));
    const client = createApiClient({
      baseUrl: "HTTPS://EXAMPLE.TEST:443",
      headers,
      transport,
    });
    expect(client.baseUrl).toBe("https://example.test/");
    expect(Object.isFrozen(client)).toBe(true);
    await apiRequest("/upload", {
      client,
      operation,
      body: new FormData(),
      method: "POST",
      headers: { "X-Owner": "request" },
    });
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-owner")).toBe("client");
  });

  it.each([
    "//other.test/items",
    "https://user:secret@example.test/items",
    "https://:secret@example.test/items",
  ])("rejects credential-routing target %s before transport", async (url) => {
    const transport = vi.fn();
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport,
    });
    await expect(apiRequest(url, { client, operation })).rejects.toThrow(
      "configured API origin",
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it("requires generated operation metadata before header preparation", async () => {
    const headers = vi.fn();
    const transport = vi.fn();
    const client = createApiClient({
      baseUrl: "https://example.test",
      headers,
      transport,
    });
    await expect(apiRequest("/items", { client })).rejects.toThrow(
      "operation metadata",
    );
    expect(headers).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([0, -1, Infinity, NaN, 2_147_483_648])(
    "rejects an invalid request deadline %s before admission",
    async (timeoutMs) => {
      const transport = vi.fn();
      const client = createApiClient({
        baseUrl: "https://example.test",
        transport,
      });
      await expect(
        apiRequest("/items", { client, operation, timeoutMs }),
      ).rejects.toThrow(RangeError);
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it("rejects an already-cancelled request with the original reason before preparing credentials", async () => {
    const failure = new Error("caller cancelled");
    const controller = new AbortController();
    controller.abort(failure);
    const headers = vi.fn();
    const transport = vi.fn();
    const client = createApiClient({
      baseUrl: "https://example.test",
      headers,
      transport,
    });
    await expect(
      apiRequest("/items", { client, operation, signal: controller.signal }),
    ).rejects.toBe(failure);
    expect(headers).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it("consumes a late credential-provider rejection after caller cancellation", async () => {
    let rejectPrepared!: (reason: unknown) => void;
    const prepared = new Promise<HeadersInit>((_resolve, reject) => {
      rejectPrepared = reject;
    });
    const controller = new AbortController();
    const failure = new Error("caller owns cancellation");
    const transport = vi.fn();
    const client = createApiClient({
      baseUrl: "https://example.test",
      headers: () => prepared,
      transport,
    });
    const pending = apiRequest("/items", {
      client,
      operation,
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toBe(failure);
    controller.abort(failure);
    await rejected;
    rejectPrepared(new Error("late credential failure"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(transport).not.toHaveBeenCalled();
  });

  it.each(["headers", "transport"] as const)(
    "preserves a rejected %s error without launching follow-up work",
    async (source) => {
      const failure = new Error(`${source} failure`);
      const transport = vi.fn(async () => {
        throw failure;
      });
      const client = createApiClient({
        baseUrl: "https://example.test",
        transport,
        ...(source === "headers"
          ? {
              headers: async () => {
                throw failure;
              },
            }
          : {}),
      });
      await expect(apiRequest("/items", { client, operation })).rejects.toBe(
        failure,
      );
      expect(transport).toHaveBeenCalledTimes(source === "headers" ? 0 : 1);
    },
  );

  it("rejects synchronously expired preparation before admitting transport", async () => {
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(111);
    const transport = vi.fn();
    const client = createApiClient({
      baseUrl: "https://example.test",
      timeoutMs: 10,
      transport,
    });
    await expect(
      apiRequest("/items", { client, operation }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("detaches caller cancellation and clears the deadline after successful settlement", async () => {
    vi.useFakeTimers();
    let admitted: AbortSignal | undefined;
    const controller = new AbortController();
    const client = createApiClient({
      baseUrl: "https://example.test",
      timeoutMs: 10,
      transport: async (request) => {
        admitted = request.signal;
        return { status: 204, data: undefined, headers: new Headers() };
      },
    });
    await apiRequest("/items", {
      client,
      operation,
      signal: controller.signal,
    });
    controller.abort();
    await vi.advanceTimersByTimeAsync(100);
    expect(admitted).toBeInstanceOf(AbortSignal);
    expect(admitted?.aborted).toBe(false);
  });

  it("forwards explicit request policies and distinguishes null from an omitted body", async () => {
    const requests: ApiTransportRequest[] = [];
    const client = createApiClient({
      baseUrl: "https://example.test",
      credentials: "include",
      transport: async (request) => {
        requests.push(request);
        return { status: 204, data: undefined, headers: new Headers() };
      },
    });
    await apiRequest("/items", { client, operation });
    await apiRequest("/items", {
      client,
      operation,
      method: "DELETE",
      body: null,
      credentials: "omit",
      redirect: "error",
      responsePolicy: "status-first-json",
      cookiePolicy: "omit",
    });
    expect(requests[0]).toMatchObject({
      method: "GET",
      credentials: "include",
    });
    expect(requests[0]).not.toHaveProperty("body");
    expect(requests[1]).toMatchObject({
      method: "DELETE",
      body: null,
      credentials: "omit",
      redirect: "error",
      responsePolicy: "status-first-json",
      cookiePolicy: "omit",
    });
  });

  it.each(["client", "request"] as const)(
    "keeps an explicitly untimed %s request cancellable beyond the default deadline",
    async (policy) => {
      vi.useFakeTimers();
      let finish!: () => void;
      const transport = vi.fn(
        (request: ApiTransportRequest) =>
          new Promise<{ status: number; data: unknown; headers: Headers }>(
            (resolve) => {
              expect(request.timeoutMs).toBeNull();
              finish = () =>
                resolve({ status: 200, data: [], headers: jsonHeaders() });
            },
          ),
      );
      const client = createApiClient({
        baseUrl: "https://example.test",
        transport,
        ...(policy === "client" ? { timeoutMs: null } : {}),
      });
      const controller = new AbortController();
      let settled = false;
      const pending = apiRequest("/items/", {
        client,
        operation,
        signal: controller.signal,
        ...(policy === "request" ? { timeoutMs: null } : {}),
      }).then((response) => {
        settled = true;
        return response;
      });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(settled).toBe(false);
      expect(transport.mock.calls[0]?.[0].signal.aborted).toBe(false);
      finish();
      expect(await pending).toMatchObject({ status: 200, kind: "documented" });

      const cancelled = apiRequest("/items/", {
        client,
        operation,
        signal: controller.signal,
        timeoutMs: null,
      });
      const rejected = expect(cancelled).rejects.toMatchObject({
        name: "AbortError",
      });
      controller.abort();
      await rejected;
      expect(transport.mock.calls[1]?.[0].signal.aborted).toBe(true);
      finish();
    },
  );

  it("allows a finite per-call deadline on an untimed client", async () => {
    vi.useFakeTimers();
    const client = createApiClient({
      baseUrl: "https://example.test",
      timeoutMs: null,
      transport: () => new Promise(() => {}),
    });
    const pending = apiRequest("/items/", { client, operation, timeoutMs: 10 });
    const rejected = expect(pending).rejects.toMatchObject({
      name: "TimeoutError",
    });
    await vi.advanceTimersByTimeAsync(10);
    await rejected;
  });

  it.each([0, -1, Infinity, NaN, 2_147_483_648])(
    "rejects invalid timeout %s while retaining the finite default",
    (timeoutMs) => {
      expect(() =>
        createApiClient({ baseUrl: "https://example.test", timeoutMs }),
      ).toThrow(RangeError);
      expect(
        createApiClient({ baseUrl: "https://example.test" }).timeoutMs,
      ).toBe(10_000);
    },
  );

  it("keeps concurrent clients and dynamic credentials independent", async () => {
    const requests: ApiTransportRequest[] = [];
    const transport = async (request: ApiTransportRequest) => {
      requests.push(request);
      return { status: 200, data: [], headers: jsonHeaders() };
    };
    let token = "first";
    const one = createApiClient({
      baseUrl: "https://one.test",
      headers: () => ({ Authorization: `Token ${token}` }),
      transport,
    });
    const two = createApiClient({
      baseUrl: "https://two.test",
      headers: { Authorization: "Token second" },
      transport,
    });
    await Promise.all([
      apiRequest("/items/", { client: one, operation }),
      apiRequest("/items/", { client: two, operation }),
    ]);
    token = "rotated";
    await apiRequest("/items/", { client: one, operation });
    expect(requests).toHaveLength(3);
    expect(
      requests.map((r) => [r.url, r.headers.get("authorization")]),
    ).toEqual(
      expect.arrayContaining([
        ["https://one.test/items/", "Token first"],
        ["https://two.test/items/", "Token second"],
        ["https://one.test/items/", "Token rotated"],
      ]),
    );
  });

  it("preserves serialized JSON and FormData without double encoding or fixed boundaries", async () => {
    const transport = vi.fn(async (request: ApiTransportRequest) => {
      expect(request.signal.aborted).toBe(false);
      return { status: 204, data: undefined, headers: new Headers() };
    });
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport,
    });
    const body = JSON.stringify({ name: "Café" });
    await apiRequest("/items/", {
      client,
      operation,
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    });
    expect(transport.mock.calls[0]?.[0].body).toBe(body);
    const form = new FormData();
    form.append(
      "file",
      new File(["<gpx>Café</gpx>"], "survey.gpx", {
        type: "application/gpx+xml",
      }),
    );
    await apiRequest("/upload/", {
      client,
      operation,
      method: "PUT",
      body: form,
      headers: { "Content-Type": "multipart/form-data" },
    });
    const sent = transport.mock.calls[1]?.[0];
    expect(sent?.body).toBe(form);
    expect(sent?.headers.has("content-type")).toBe(false);
  });

  it("returns HTTP errors and explicitly marks undeclared responses", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        status: 400,
        data: { detail: "invalid" },
        headers: jsonHeaders(),
      })
      .mockResolvedValueOnce({
        status: 502,
        data: "gateway",
        headers: new Headers({ "content-type": "text/plain" }),
      });
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport,
    });
    expect(await apiRequest("/items/", { client, operation })).toMatchObject({
      kind: "documented",
      status: 400,
    });
    expect(await apiRequest("/items/", { client, operation })).toMatchObject({
      kind: "unexpected",
      status: 502,
      data: "gateway",
    });
  });

  it("enforces client context and same-origin credential routing before transport", async () => {
    await expect(apiRequest("/items/", undefined as never)).rejects.toThrow(
      "ApiClient",
    );
    const transport = vi.fn();
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport,
    });
    await expect(
      apiRequest("https://other.test/items/", { client, operation }),
    ).rejects.toThrow("configured API origin");
    expect(transport).not.toHaveBeenCalled();
  });

  it("includes asynchronous header preparation in the deadline and prevents late launch", async () => {
    vi.useFakeTimers();
    let finish!: (value: HeadersInit) => void;
    const transport = vi.fn();
    const client = createApiClient({
      baseUrl: "https://example.test",
      timeoutMs: 10,
      headers: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      transport,
    });
    const pending = apiRequest("/items/", { client, operation });
    const rejected = expect(pending).rejects.toMatchObject({
      name: "TimeoutError",
    });
    await vi.advanceTimersByTimeAsync(10);
    await rejected;
    finish({ Authorization: "late" });
    await Promise.resolve();
    expect(transport).not.toHaveBeenCalled();
  });

  it("passes a remaining deadline and suppresses transports ignoring abort", async () => {
    let finish!: (value: {
      status: number;
      data: unknown;
      headers: Headers;
    }) => void;
    const transport = vi.fn(
      (request: ApiTransportRequest) =>
        new Promise<{ status: number; data: unknown; headers: Headers }>(
          (resolve) => {
            expect(request.signal.aborted).toBe(false);
            finish = resolve;
          },
        ),
    );
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport,
      timeoutMs: 1000,
    });
    const controller = new AbortController();
    const pending = apiRequest("/items/", {
      client,
      operation,
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(transport.mock.calls[0]?.[0].timeoutMs).toBeLessThanOrEqual(1000);
    controller.abort();
    await rejected;
    finish({ status: 200, data: [], headers: jsonHeaders() });
    await Promise.resolve();
  });

  it("consumes a transport rejection after synchronous cancellation", async () => {
    const controller = new AbortController();
    const transport = vi.fn(() => {
      controller.abort();
      return Promise.reject(
        new Error("Transport rejected after cancellation."),
      );
    });
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport,
    });
    await expect(
      apiRequest("/items/", { client, operation, signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    // Vitest also fails this regression if the transport rejection is unhandled.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("rejects decoding that completes after the deadline before the timer can run", async () => {
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(101)
      .mockReturnValueOnce(111);
    const transport = vi.fn(async () => ({
      status: 200,
      data: [],
      headers: jsonHeaders(),
    }));
    const client = createApiClient({
      baseUrl: "https://example.test",
      timeoutMs: 10,
      transport,
    });
    await expect(
      apiRequest("/items/", { client, operation }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });
});

it("merges tuple header inputs case-insensitively without mutating either caller array", async () => {
  const configured: [string, string][] = [
    ["X-Trace", "first"],
    ["x-trace", "second"],
    ["X-Client", "source"],
  ];
  const perRequest: [string, string][] = [
    ["X-Trace", "request-first"],
    ["x-trace", "request-final"],
  ];
  const originalConfigured = structuredClone(configured);
  const originalPerRequest = structuredClone(perRequest);
  let received: Headers | undefined;
  const client = createApiClient({
    baseUrl: "https://example.test",
    headers: configured,
    transport: async (request) => {
      received = request.headers;
      return { status: 204, data: undefined, headers: new Headers() };
    },
  });
  await apiRequest("/headers", { client, operation, headers: perRequest });
  expect(Object.fromEntries(received!.entries())).toEqual({
    "x-trace": "request-final",
    "x-client": "source",
  });
  expect(configured).toEqual(originalConfigured);
  expect(perRequest).toEqual(originalPerRequest);
});
