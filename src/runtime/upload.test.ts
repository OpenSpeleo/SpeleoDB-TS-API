import { afterEach, expect, it, vi } from "vitest";
import { createApiClient, apiRequest } from "./request";
import { xhrTransport } from "./browser";
import type { ApiOperationMetadata, ApiTransportRequest } from "./types";

class UploadRequest {
  static current: UploadRequest;
  static instances = 0;
  static sendFailure: Error | undefined;
  upload: {
    onprogress?: (event: {
      loaded: number;
      total: number;
      lengthComputable: boolean;
    }) => void;
    onload?: () => void;
  } = {};
  response: ArrayBuffer | null = new TextEncoder().encode('{"accepted":true}')
    .buffer;
  status = 201;
  timeout = -1;
  withCredentials = false;
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  ontimeout?: () => void;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn(() => {
    if (UploadRequest.sendFailure) throw UploadRequest.sendFailure;
  });
  abort = vi.fn(() => this.onabort?.());
  getAllResponseHeaders = () =>
    "Content-Type: application/json\r\nX-Upload: accepted\r\n";
  constructor() {
    UploadRequest.current = this;
    UploadRequest.instances++;
  }
}

const operation: ApiOperationMetadata = {
  operationId: "upload",
  responses: { "201": { content: { "application/json": "json" } } },
};
afterEach(() => {
  vi.unstubAllGlobals();
  UploadRequest.instances = 0;
  UploadRequest.sendFailure = undefined;
});

function request(
  overrides: Partial<ApiTransportRequest> = {},
): ApiTransportRequest {
  return {
    url: "https://example.test/upload",
    method: "POST",
    headers: new Headers(),
    signal: new AbortController().signal,
    timeoutMs: 0.25,
    operation,
    ...overrides,
  };
}

it("publishes upload progress and upload completion before the server response", async () => {
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const progress = vi.fn(),
    uploaded = vi.fn();
  const client = createApiClient({
    baseUrl: "https://example.test",
    credentials: "include",
  });
  const body = new FormData();
  body.append("file", new Blob(["payload"]), "input.bin");
  let settled = false;
  const pending = apiRequest("/upload", {
    client,
    operation,
    method: "PUT",
    body,
    onUploadProgress: progress,
    onUploadComplete: uploaded,
  }).then((result) => {
    settled = true;
    return result;
  });
  const xhr = UploadRequest.current;
  expect(xhr.send).toHaveBeenCalledWith(body);
  expect(xhr.open).toHaveBeenCalledWith("PUT", "https://example.test/upload");
  expect(xhr.withCredentials).toBe(true);
  xhr.upload.onprogress?.({ loaded: 5, total: 10, lengthComputable: true });
  expect(progress).toHaveBeenCalledWith({
    loaded: 5,
    total: 10,
    lengthComputable: true,
  });
  xhr.upload.onload?.();
  expect(uploaded).toHaveBeenCalledOnce();
  expect(settled).toBe(false);
  xhr.onload?.();
  const result = await pending;
  expect(result).toMatchObject({
    status: 201,
    data: { accepted: true },
    kind: "documented",
  });
  expect(result.headers.get("x-upload")).toBe("accepted");
});

it("aborts the admitted XHR adapter and suppresses late completion", async () => {
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const client = createApiClient({ baseUrl: "https://example.test" });
  const abort = new AbortController();
  const progress = vi.fn();
  const uploaded = vi.fn();
  const pending = apiRequest("/upload", {
    client,
    operation,
    signal: abort.signal,
    onUploadProgress: progress,
    onUploadComplete: uploaded,
  });
  const rejected = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  abort.abort();
  await rejected;
  expect(UploadRequest.current.abort).toHaveBeenCalledOnce();
  UploadRequest.current.upload.onprogress?.({
    loaded: 1,
    total: 1,
    lengthComputable: true,
  });
  UploadRequest.current.upload.onload?.();
  expect(progress).not.toHaveBeenCalled();
  expect(uploaded).not.toHaveBeenCalled();
  UploadRequest.current.onload?.();
});

it("disables the XHR deadline explicitly while retaining caller cancellation", async () => {
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const client = createApiClient({
    baseUrl: "https://example.test",
    timeoutMs: null,
  });
  const controller = new AbortController();
  const pending = apiRequest("/upload", {
    client,
    operation,
    signal: controller.signal,
    onUploadProgress: () => {},
  });
  expect(UploadRequest.current.timeout).toBe(0);
  const rejected = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  controller.abort();
  await rejected;
  expect(UploadRequest.current.abort).toHaveBeenCalledOnce();
});

it("refuses transport policies XHR cannot enforce", async () => {
  const client = createApiClient({ baseUrl: "https://example.test" });
  await expect(
    apiRequest("/upload", {
      client,
      operation,
      onUploadProgress: () => {},
      redirect: "manual",
    }),
  ).rejects.toThrow("redirect refusal");
  await expect(
    apiRequest("/upload", {
      client,
      operation,
      onUploadProgress: () => {},
      cookiePolicy: "omit",
    }),
  ).rejects.toThrow("same-origin cookies");
});

it.each(["progress", "completion", "explicit"] as const)(
  "rejects status-first responses before admitting %s XHR requests",
  async (selection) => {
    vi.stubGlobal("XMLHttpRequest", UploadRequest);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const progress = vi.fn();
    const uploaded = vi.fn();
    const client = createApiClient({
      baseUrl: "https://example.test",
      timeoutMs: null,
      ...(selection === "explicit" ? { transport: xhrTransport } : {}),
    });
    await expect(
      apiRequest("/upload", {
        client,
        operation,
        responsePolicy: "status-first-json",
        ...(selection === "progress" ? { onUploadProgress: progress } : {}),
        ...(selection === "completion" ? { onUploadComplete: uploaded } : {}),
      }),
    ).rejects.toThrow(
      new TypeError(
        "The XHR adapter does not support status-first responses. Use the fetch transport.",
      ),
    );
    expect(UploadRequest.instances).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
    expect(uploaded).not.toHaveBeenCalled();
  },
);

it("decodes UTF-8 response bytes and preserves binary bytes and MIME type", async () => {
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const client = createApiClient({ baseUrl: "https://example.test" });
  const textPending = apiRequest("/upload", {
    client,
    operation,
    onUploadProgress: () => {},
  });
  UploadRequest.current.response = new TextEncoder().encode(
    '{"name":"Café 🦇"}',
  ).buffer;
  UploadRequest.current.onload?.();
  expect((await textPending).data).toEqual({ name: "Café 🦇" });

  const binaryPending = apiRequest("/upload", {
    client,
    operation: {
      operationId: "binary",
      responses: {
        "201": { content: { "application/zip": "blob" } },
      },
    },
    onUploadProgress: () => {},
  });
  UploadRequest.current.response = new Uint8Array([0, 255, 128, 5]).buffer;
  UploadRequest.current.getAllResponseHeaders = () =>
    "Content-Type: application/zip\r\n";
  UploadRequest.current.onload?.();
  const binary = (await binaryPending).data as Blob;
  expect(binary.type).toBe("application/zip");
  expect(new Uint8Array(await binary.arrayBuffer())).toEqual(
    new Uint8Array([0, 255, 128, 5]),
  );
});

it.each([
  { redirect: "error" as const },
  { credentials: "omit" as const },
  { responsePolicy: "status-first-json" as const },
])(
  "rejects unsupported XHR policies before constructing a request",
  async (policy) => {
    vi.stubGlobal("XMLHttpRequest", UploadRequest);
    await expect(xhrTransport(request(policy))).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(UploadRequest.instances).toBe(0);
  },
);

it("rejects an already-aborted XHR before construction with the original reason", async () => {
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const controller = new AbortController();
  const failure = new Error("cancel before admission");
  controller.abort(failure);
  await expect(
    xhrTransport(request({ signal: controller.signal })),
  ).rejects.toBe(failure);
  expect(UploadRequest.instances).toBe(0);
});

it.each(["error", "timeout", "send", "abort"] as const)(
  "settles and detaches cancellation after XHR %s failure",
  async (failure) => {
    vi.stubGlobal("XMLHttpRequest", UploadRequest);
    const controller = new AbortController();
    const sendFailure = new Error("synchronous send failure");
    if (failure === "send") UploadRequest.sendFailure = sendFailure;
    const pending = xhrTransport(request({ signal: controller.signal }));
    const rejected = expect(pending).rejects.toMatchObject({
      name:
        failure === "timeout"
          ? "TimeoutError"
          : failure === "abort"
            ? "AbortError"
            : failure === "send"
              ? "Error"
              : "TypeError",
    });
    const xhr = UploadRequest.current;
    if (failure === "error") xhr.onerror?.();
    if (failure === "timeout") xhr.ontimeout?.();
    if (failure === "abort") xhr.onabort?.();
    await rejected;
    if (failure === "send") await expect(pending).rejects.toBe(sendFailure);
    controller.abort();
    expect(xhr.abort).not.toHaveBeenCalled();
  },
);

it("rounds a finite XHR deadline and preserves headers while detaching completed cancellation", async () => {
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const controller = new AbortController();
  const pending = xhrTransport(
    request({
      signal: controller.signal,
      headers: new Headers({ "X-Trace": "owned" }),
      credentials: "same-origin",
      redirect: "follow",
    }),
  );
  const xhr = UploadRequest.current;
  expect(xhr.timeout).toBe(1);
  expect(xhr.withCredentials).toBe(false);
  expect(xhr.setRequestHeader).toHaveBeenCalledWith("x-trace", "owned");
  xhr.upload.onload?.();
  xhr.getAllResponseHeaders = () =>
    "Content-Type: application/json\r\nX-Trace: first\r\nX-Trace: second: detail\r\n";
  xhr.onload?.();
  const response = await pending;
  expect(response.headers.get("x-trace")).toBe("first, second: detail");
  controller.abort();
  expect(xhr.abort).not.toHaveBeenCalled();
});

it("does not let unknown-length progress or throwing observers change HTTP ownership", async () => {
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const progress = vi.fn(() => {
    throw new Error("progress observer failed");
  });
  const completed = vi.fn(() => {
    throw new Error("completion observer failed");
  });
  const pending = xhrTransport(
    request({ onUploadProgress: progress, onUploadComplete: completed }),
  );
  const xhr = UploadRequest.current;
  expect(() =>
    xhr.upload.onprogress?.({ loaded: 7, total: 0, lengthComputable: false }),
  ).not.toThrow();
  expect(progress).toHaveBeenCalledWith({ loaded: 7, lengthComputable: false });
  expect(() => xhr.upload.onload?.()).not.toThrow();
  expect(completed).toHaveBeenCalledOnce();
  xhr.onload?.();
  expect(await pending).toMatchObject({
    status: 201,
    data: { accepted: true },
  });
});

it("selects XHR for completion-only observers and accepts an empty response", async () => {
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const completed = vi.fn();
  const client = createApiClient({ baseUrl: "https://example.test" });
  const pending = apiRequest("/upload", {
    client,
    operation: {
      operationId: "empty-upload",
      responses: { "204": { content: {} } },
    },
    onUploadComplete: completed,
  });
  const xhr = UploadRequest.current;
  xhr.status = 204;
  xhr.response = null;
  xhr.getAllResponseHeaders = () => "";
  xhr.upload.onprogress?.({ loaded: 7, total: 7, lengthComputable: true });
  xhr.upload.onload?.();
  xhr.onload?.();
  expect(completed).toHaveBeenCalledOnce();
  expect(await pending).toMatchObject({
    status: 204,
    data: undefined,
    kind: "documented",
  });
});

it("propagates a malformed XHR success through the decoder", async () => {
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const pending = xhrTransport(request());
  const rejected = expect(pending).rejects.toThrow(
    "The server returned invalid JSON.",
  );
  UploadRequest.current.response = new TextEncoder().encode(
    "invalid JSON",
  ).buffer;
  UploadRequest.current.onload?.();
  await rejected;
});

it("preserves binary XHR bytes when a wildcard response has no Content-Type header", async () => {
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  const pending = xhrTransport(
    request({
      operation: {
        operationId: "untyped-binary",
        responses: { "201": { content: { "*/*": "blob" } } },
      },
    }),
  );
  const xhr = UploadRequest.current;
  xhr.response = new Uint8Array([0xff, 0x80, 0]).buffer;
  xhr.getAllResponseHeaders = () => "";
  xhr.onload?.();
  const result = await pending;
  expect(result.data).toBeInstanceOf(Blob);
  expect((result.data as Blob).type).toBe("");
  expect(new Uint8Array(await (result.data as Blob).arrayBuffer())).toEqual(
    new Uint8Array([0xff, 0x80, 0]),
  );
});
