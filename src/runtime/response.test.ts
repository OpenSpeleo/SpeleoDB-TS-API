import { describe, expect, it } from "vitest";
import {
  decodeResponse,
  isDocumentedResponse,
  responseMetadata,
} from "./response";
import type { ApiOperationMetadata, ApiTransportRequest } from "./types";

const operation: ApiOperationMetadata = {
  operationId: "response-codecs",
  responses: {
    "200": {
      content: {
        "application/json": "json",
        "application/geojson": "json",
        "application/vnd.speleodb": "json",
        "application/xml": "text",
      },
    },
    "204": { content: {} },
    "400": { content: { "application/geojson": "json" } },
  },
};

function request(
  overrides: Partial<ApiTransportRequest> = {},
): ApiTransportRequest {
  return {
    url: "https://example.test/response",
    method: "GET",
    headers: new Headers(),
    signal: new AbortController().signal,
    timeoutMs: null,
    operation,
    ...overrides,
  };
}

function decode(
  response: Response,
  overrides: Partial<ApiTransportRequest> = {},
) {
  return decodeResponse(
    request(overrides),
    response.status,
    response.headers,
    () => response.text(),
    () => response.blob(),
  );
}

describe("response metadata selection", () => {
  it("prefers exact status over a status range and the default", () => {
    const exact = { content: { "application/json": "json" as const } };
    const range = { content: { "text/plain": "text" as const } };
    const fallback = { content: { "*/*": "blob" as const } };
    const metadata: ApiOperationMetadata = {
      operationId: "status-precedence",
      responses: { "200": exact, "2XX": range, default: fallback },
    };
    expect(responseMetadata(metadata, 200)).toBe(exact);
    expect(responseMetadata(metadata, 201)).toBe(range);
    expect(responseMetadata(metadata, 503)).toBe(fallback);
    expect(responseMetadata(operation, 503)).toBeUndefined();
  });

  it("requires matching media, empty data for bodyless status, and no unexpected flag", () => {
    const headers = new Headers({
      "Content-Type": "APPLICATION/JSON; charset=utf-8",
    });
    expect(
      isDocumentedResponse(operation, { status: 200, data: {}, headers }),
    ).toBe(true);
    expect(
      isDocumentedResponse(operation, {
        status: 200,
        data: {},
        headers,
        unexpected: true,
      }),
    ).toBe(false);
    expect(
      isDocumentedResponse(operation, {
        status: 200,
        data: "html",
        headers: new Headers({ "content-type": "text/html" }),
      }),
    ).toBe(false);
    expect(
      isDocumentedResponse(operation, {
        status: 200,
        data: {},
        headers: new Headers(),
      }),
    ).toBe(false);
    expect(
      isDocumentedResponse(operation, {
        status: 204,
        data: undefined,
        headers,
      }),
    ).toBe(true);
    expect(
      isDocumentedResponse(operation, {
        status: 204,
        data: "unexpected body",
        headers,
      }),
    ).toBe(false);
    expect(
      isDocumentedResponse(operation, { status: 503, data: {}, headers }),
    ).toBe(false);
  });

  it("prefers exact media over its range and the universal fallback", async () => {
    const metadata: ApiOperationMetadata = {
      operationId: "media-precedence",
      responses: {
        "200": {
          content: {
            "application/json": "json",
            "application/*": "text",
            "*/*": "blob",
          },
        },
      },
    };
    for (const [type, text, expected] of [
      ["application/json", "null", null],
      ["application/xml", "<document/>", "<document/>"],
    ] as const) {
      const result = await decode(
        new Response(text, { headers: { "content-type": type } }),
        { operation: metadata },
      );
      expect(result.data).toEqual(expected);
      expect(isDocumentedResponse(metadata, result)).toBe(true);
    }
    const result = await decode(
      new Response(new Uint8Array([0, 255]), {
        headers: { "content-type": "image/png" },
      }),
      { operation: metadata },
    );
    expect(result.data).toBeInstanceOf(Blob);
    expect(new Uint8Array(await (result.data as Blob).arrayBuffer())).toEqual(
      new Uint8Array([0, 255]),
    );
    expect(isDocumentedResponse(metadata, result)).toBe(true);
  });
});

describe("response decoding", () => {
  it.each([
    "application/geojson",
    "application/vnd.speleodb",
    "APPLICATION/JSON; charset=utf-8",
  ])(
    "uses the declared JSON codec for %s, including status-first reads",
    async (type) => {
      const body = { type: "FeatureCollection", features: [], name: "Café 🦇" };
      for (const responsePolicy of ["default", "status-first-json"] as const) {
        const result = await decode(
          new Response(JSON.stringify(body), {
            headers: { "content-type": type },
          }),
          { responsePolicy },
        );
        expect(result.data).toEqual(body);
        expect(isDocumentedResponse(operation, result)).toBe(true);
      }
    },
  );

  it("preserves malformed declared JSON error status without claiming a DTO", async () => {
    const result = await decode(
      new Response("broken GeoJSON", {
        status: 400,
        headers: { "content-type": "application/geojson" },
      }),
    );
    expect(result).toMatchObject({
      status: 400,
      data: "broken GeoJSON",
      unexpected: true,
    });
    expect(isDocumentedResponse(operation, result)).toBe(false);
    await expect(
      decode(
        new Response("broken GeoJSON", {
          headers: { "content-type": "application/geojson" },
        }),
      ),
    ).rejects.toThrow("The server returned invalid JSON.");
  });

  it.each([
    ["HEAD", 200],
    ["GET", 204],
    ["GET", 205],
    ["GET", 304],
  ] as const)(
    "does not consume a body for %s status %s",
    async (method, status) => {
      const response = new Response(status === 200 ? "not parsed" : null, {
        status,
      });
      expect(await decode(response, { method })).toMatchObject({
        status,
        data: undefined,
      });
      expect(response.bodyUsed).toBe(false);
    },
  );

  it("distinguishes an empty bodyless response from an unexpected body", async () => {
    const metadata: ApiOperationMetadata = {
      operationId: "empty",
      responses: { "200": { content: {} } },
    };
    const empty = await decode(new Response(""), { operation: metadata });
    const nonempty = await decode(new Response("unexpected"), {
      operation: metadata,
    });
    expect(empty.data).toBeUndefined();
    expect(isDocumentedResponse(metadata, empty)).toBe(true);
    expect(nonempty.data).toBe("unexpected");
    expect(isDocumentedResponse(metadata, nonempty)).toBe(false);
  });

  it.each(["application/problem+json", "application/vnd.speleodb+json"])(
    "decodes undeclared %s without treating its status as documented",
    async (type) => {
      const result = await decode(
        new Response('{"detail":"upstream failure"}', {
          status: 502,
          headers: { "content-type": type },
        }),
      );
      expect(result.data).toEqual({ detail: "upstream failure" });
      expect(isDocumentedResponse(operation, result)).toBe(false);
    },
  );

  it("preserves undeclared text, binary and missing-media payloads", async () => {
    const text = await decode(
      new Response("gateway", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    );
    const binary = await decode(
      new Response(new Uint8Array([0, 255]), {
        status: 502,
        headers: { "content-type": "application/octet-stream" },
      }),
    );
    const missing = await decode(
      new Response(new TextEncoder().encode("no media"), { status: 502 }),
    );
    const empty = await decode(new Response(null, { status: 502 }));
    expect(text.data).toBe("gateway");
    expect(binary.data).toBeInstanceOf(Blob);
    expect(new Uint8Array(await (binary.data as Blob).arrayBuffer())).toEqual(
      new Uint8Array([0, 255]),
    );
    expect(missing.data).toBe("no media");
    expect(empty.data).toBeUndefined();
    for (const result of [text, binary, missing, empty])
      expect(isDocumentedResponse(operation, result)).toBe(false);
  });

  it("rejects non-JSON status-first success before reading its body", async () => {
    const response = new Response("private HTML", {
      headers: { "content-type": "text/html" },
    });
    await expect(
      decode(response, { responsePolicy: "status-first-json" }),
    ).rejects.toThrow("The server did not return JSON.");
    expect(response.bodyUsed).toBe(false);
  });

  it.each([0, 302, 403, 503])(
    "never reads a status-first denial body for %s",
    async (status) => {
      let reads = 0;
      const result = await decodeResponse(
        request({ responsePolicy: "status-first-json" }),
        status,
        new Headers(),
        async () => {
          reads++;
          throw new Error("body must not be read");
        },
        async () => {
          reads++;
          throw new Error("body must not be read");
        },
      );
      expect(result).toMatchObject({ status, data: null, unexpected: true });
      expect(reads).toBe(0);
    },
  );

  it.each(["application/json", "application/octet-stream"])(
    "propagates an actual failed body stream for %s",
    async (type) => {
      const failure = new Error("stream disconnected");
      const body = new ReadableStream({
        start(controller) {
          controller.error(failure);
        },
      });
      await expect(
        decode(new Response(body, { headers: { "content-type": type } })),
      ).rejects.toBe(failure);
    },
  );
});
