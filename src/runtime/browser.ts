import { decodeResponse } from "./response";
import type { ApiTransportRequest, ApiTransportResponse } from "./types";

export async function fetchTransport(
  request: ApiTransportRequest,
): Promise<ApiTransportResponse> {
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    signal: request.signal,
    ...(request.body !== undefined ? { body: request.body } : {}),
    ...(request.credentials !== undefined
      ? { credentials: request.credentials }
      : {}),
    ...(request.redirect !== undefined ? { redirect: request.redirect } : {}),
  };
  if (request.cookiePolicy === "omit") init.credentials = "omit";
  const response = await fetch(request.url, init);
  if (request.responsePolicy === "status-first-json" && !response.ok) {
    void response.body?.cancel().catch(() => {});
  }
  return decodeResponse(
    request,
    response.status,
    response.headers,
    () => response.text(),
    () => response.blob(),
  );
}

/** XHR is restricted to browser uploads that require progress events. */
export function xhrTransport(
  request: ApiTransportRequest,
): Promise<ApiTransportResponse> {
  if (request.redirect && request.redirect !== "follow") {
    return Promise.reject(
      new TypeError(
        "XHR cannot enforce redirect refusal. Use the fetch transport.",
      ),
    );
  }
  if (request.cookiePolicy === "omit" || request.credentials === "omit") {
    return Promise.reject(
      new TypeError(
        "XHR cannot omit same-origin cookies. Use the fetch transport.",
      ),
    );
  }
  if (request.responsePolicy === "status-first-json") {
    return Promise.reject(
      new TypeError(
        "The XHR adapter does not support status-first responses. Use the fetch transport.",
      ),
    );
  }
  return new Promise((resolve, reject) => {
    request.signal.throwIfAborted();
    const xhr = new XMLHttpRequest();
    const abort = () => {
      xhr.abort();
      reject(request.signal.reason);
    };
    const cleanup = () => request.signal.removeEventListener("abort", abort);
    xhr.open(request.method, request.url);
    xhr.responseType = "arraybuffer";
    xhr.timeout =
      request.timeoutMs === null
        ? 0
        : Math.max(1, Math.ceil(request.timeoutMs));
    xhr.withCredentials = request.credentials === "include";
    request.headers.forEach((value, name) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (request.signal.aborted) return;
      try {
        request.onUploadProgress?.({
          loaded: event.loaded,
          lengthComputable: event.lengthComputable,
          ...(event.lengthComputable ? { total: event.total } : {}),
        });
      } catch {
        /* Observer failures cannot change HTTP ownership. */
      }
    };
    xhr.upload.onload = () => {
      if (request.signal.aborted) return;
      try {
        request.onUploadComplete?.();
      } catch {
        /* Observer only. */
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new TypeError("Network request failed."));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new DOMException("Request timed out.", "TimeoutError"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(
        request.signal.reason ??
          new DOMException("Request aborted.", "AbortError"),
      );
    };
    xhr.onload = () => {
      cleanup();
      const headers = new Headers();
      for (const line of xhr
        .getAllResponseHeaders()
        .trim()
        .split(/[\r\n]+/)) {
        const separator = line.indexOf(":");
        if (separator > 0)
          headers.append(
            line.slice(0, separator).trim(),
            line.slice(separator + 1).trim(),
          );
      }
      const bytes = (xhr.response as ArrayBuffer | null) ?? new ArrayBuffer(0);
      decodeResponse(
        request,
        xhr.status,
        headers,
        async () => new TextDecoder().decode(bytes),
        async () =>
          new Blob([bytes], {
            type: headers.get("content-type") ?? "",
          }),
      ).then(resolve, reject);
    };
    request.signal.addEventListener("abort", abort, { once: true });
    try {
      xhr.send(request.body as XMLHttpRequestBodyInit | null | undefined);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export function browserTransport(
  request: ApiTransportRequest,
): Promise<ApiTransportResponse> {
  return request.onUploadProgress || request.onUploadComplete
    ? xhrTransport(request)
    : fetchTransport(request);
}
