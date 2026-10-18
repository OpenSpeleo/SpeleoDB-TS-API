import type {
  ApiOperationMetadata,
  ApiResponseMetadata,
  ApiTransportRequest,
  ApiTransportResponse,
} from "./types";

export function responseMetadata(
  operation: ApiOperationMetadata,
  status: number,
): ApiResponseMetadata | undefined {
  return (
    operation.responses[String(status)] ??
    operation.responses[`${Math.floor(status / 100)}XX`] ??
    operation.responses.default
  );
}

function mediaType(headers: Headers): string {
  return (headers.get("content-type") ?? "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
}

function matchingMediaType(
  metadata: ApiResponseMetadata,
  actual: string,
): string | undefined {
  if (metadata.content[actual]) return actual;
  const range = `${actual.split("/")[0]}/*`;
  if (metadata.content[range]) return range;
  return metadata.content["*/*"] ? "*/*" : undefined;
}

export function isDocumentedResponse(
  operation: ApiOperationMetadata,
  response: ApiTransportResponse,
): boolean {
  if (response.unexpected) return false;
  const metadata = responseMetadata(operation, response.status);
  if (!metadata) return false;
  const expected = Object.keys(metadata.content);
  if (!expected.length) return response.data === undefined;
  const contentType = mediaType(response.headers);
  return matchingMediaType(metadata, contentType) !== undefined;
}

/** Status-first GIS denials must never wait for, decode, or reflect an error body. */
export async function decodeResponse(
  request: ApiTransportRequest,
  status: number,
  headers: Headers,
  readText: () => Promise<string>,
  readBlob: () => Promise<Blob>,
): Promise<ApiTransportResponse> {
  if (
    request.responsePolicy === "status-first-json" &&
    (status < 200 || status >= 300)
  ) {
    return { status, headers, data: null, unexpected: true };
  }
  if (request.method === "HEAD" || [204, 205, 304].includes(status)) {
    return { status, headers, data: undefined };
  }
  const metadata = responseMetadata(request.operation, status);
  const type = mediaType(headers);
  const declaredType = metadata ? matchingMediaType(metadata, type) : undefined;
  const declared = declaredType ? metadata?.content[declaredType] : undefined;
  // Some declared JSON media, including application/geojson, have no +json suffix.
  const isJson =
    declared === "json" || /^application\/(?:[\w.-]+\+)?json$/.test(type);
  if (request.responsePolicy === "status-first-json" && !isJson) {
    throw new TypeError("The server did not return JSON.");
  }
  if (
    declared === "blob" ||
    (!isJson && !type.startsWith("text/") && type !== "" && declared !== "text")
  ) {
    return { status, headers, data: await readBlob() };
  }
  const text = await readText();
  if (!text && metadata && Object.keys(metadata.content).length === 0) {
    return { status, headers, data: undefined };
  }
  if (isJson) {
    try {
      return { status, headers, data: JSON.parse(text) as unknown };
    } catch {
      if (status >= 200 && status < 300)
        throw new TypeError("The server returned invalid JSON.");
      // Preserve error status without claiming the unparsed text is a declared DTO.
      return { status, headers, data: text, unexpected: true };
    }
  }
  return {
    status,
    headers,
    data:
      declared === "text" || type.startsWith("text/")
        ? text
        : text || undefined,
  };
}
