import { browserTransport } from "./browser";
import { isDocumentedResponse } from "./response";
import type {
  ApiClient,
  ApiClientOptions,
  ApiRequestOptions,
  ApiResponse,
  ApiTransportRequest,
  ApiTransportResponse,
} from "./types";

const MAX_TIMEOUT = 2_147_483_647;

function checkedTimeout(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0 || value > MAX_TIMEOUT) {
    throw new RangeError(
      "Request timeout must be a positive finite timer duration.",
    );
  }
  return value;
}

/** Generated defaults precede caller entries, including differently cased names. */
function mergedHeaders(...sources: (HeadersInit | undefined)[]): Headers {
  const headers = new Headers();
  for (const source of sources) {
    if (!source) continue;
    if (source instanceof Headers) {
      source.forEach((value, name) => headers.set(name, value));
    } else if (Symbol.iterator in source) {
      for (const [name, value] of source as Iterable<
        readonly [string, string]
      >) {
        headers.set(name, value);
      }
    } else {
      for (const [name, value] of Object.entries(source))
        headers.set(name, value);
    }
  }
  return headers;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const base = new URL(options.baseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new TypeError(
      "API base URL must be an HTTP(S) origin without credentials, path, query, or fragment.",
    );
  }
  return Object.freeze({
    baseUrl: base.toString(),
    transport: options.transport ?? browserTransport,
    headers: options.headers,
    timeoutMs: checkedTimeout(
      options.timeoutMs === undefined ? 10_000 : options.timeoutMs,
    ),
    credentials: options.credentials,
  });
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) reject(signal.reason);
        else resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
    // The admitted operation may abort synchronously before returning its promise.
    // Attach both handlers before checking the signal so a late rejection is consumed.
    if (signal.aborted) {
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    }
  });
}

/** Orval's explicit two-argument signature makes client context available per call. */
export async function apiRequest<
  T extends ApiTransportResponse = ApiTransportResponse,
>(url: string, options: ApiRequestOptions): Promise<ApiResponse<T>> {
  if (!options?.client)
    throw new TypeError("An ApiClient is required for every API operation.");
  if (!options.operation)
    throw new TypeError("Generated API operation metadata is required.");
  const { client, operation } = options;
  const timeoutMs = checkedTimeout(
    options.timeoutMs === undefined ? client.timeoutMs : options.timeoutMs,
  );
  const startedAt = performance.now();
  const controller = new AbortController();
  const onAbort = () =>
    controller.abort(
      options.signal?.reason ??
        new DOMException("Request aborted.", "AbortError"),
    );
  if (options.signal?.aborted) onAbort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });
  const timer =
    timeoutMs === null
      ? undefined
      : setTimeout(
          () =>
            controller.abort(
              new DOMException("Request timed out.", "TimeoutError"),
            ),
          timeoutMs,
        );
  try {
    controller.signal.throwIfAborted();
    const response = await abortable(
      (async () => {
        const configuredHeaders =
          typeof client.headers === "function"
            ? await client.headers()
            : client.headers;
        controller.signal.throwIfAborted();
        const headers = mergedHeaders(configuredHeaders, options.headers);
        if (options.body instanceof FormData) headers.delete("content-type");
        // OpenAPI request media ranges select a callable variant, but HTTP
        // Content-Type must be concrete. Explicit concrete caller headers win.
        if (headers.get("content-type")?.split(";")[0]?.includes("*")) {
          const bodyType =
            options.body instanceof Blob ? options.body.type : "";
          headers.set(
            "content-type",
            bodyType && !bodyType.includes("*")
              ? bodyType
              : "application/octet-stream",
          );
        }
        const target = new URL(url, client.baseUrl);
        if (
          target.origin !== new URL(client.baseUrl).origin ||
          target.username ||
          target.password
        ) {
          throw new TypeError(
            "Generated API requests must remain on the configured API origin.",
          );
        }
        const remaining =
          timeoutMs === null
            ? null
            : timeoutMs - (performance.now() - startedAt);
        if (remaining !== null && remaining <= 0)
          throw new DOMException("Request timed out.", "TimeoutError");
        const request: ApiTransportRequest = {
          url: target.toString(),
          method: options.method ?? "GET",
          headers,
          signal: controller.signal,
          timeoutMs: remaining,
          operation,
          ...(options.body !== undefined ? { body: options.body } : {}),
          ...((options.credentials ?? client.credentials) !== undefined
            ? { credentials: options.credentials ?? client.credentials! }
            : {}),
          ...(options.redirect !== undefined
            ? { redirect: options.redirect }
            : {}),
          ...(options.responsePolicy
            ? { responsePolicy: options.responsePolicy }
            : {}),
          ...(options.cookiePolicy
            ? { cookiePolicy: options.cookiePolicy }
            : {}),
          ...(options.onUploadProgress
            ? { onUploadProgress: options.onUploadProgress }
            : {}),
          ...(options.onUploadComplete
            ? { onUploadComplete: options.onUploadComplete }
            : {}),
        };
        return client.transport(request);
      })(),
      controller.signal,
    );
    // Synchronous response decoding can occupy the event loop beyond the timer.
    // Check the clock as well before publishing the result.
    if (timeoutMs !== null && performance.now() - startedAt >= timeoutMs) {
      controller.abort(new DOMException("Request timed out.", "TimeoutError"));
    }
    controller.signal.throwIfAborted();
    return isDocumentedResponse(operation, response)
      ? ({ ...response, kind: "documented" } as ApiResponse<T>)
      : { ...response, kind: "unexpected" };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
