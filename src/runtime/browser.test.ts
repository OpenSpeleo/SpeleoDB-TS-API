import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, createApiClient } from "./request";
import type { ApiOperationMetadata } from "./types";

const operation: ApiOperationMetadata = {
  operationId: "browser",
  responses: {
    "200": {
      content: {
        "application/json": "json",
        "text/plain": "text",
        "application/zip": "blob",
      },
    },
    "204": { content: {} },
    "304": { content: {} },
    "403": { content: { "application/json": "json" } },
  },
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("browser decoding", () => {
  const client = createApiClient({ baseUrl: "https://example.test" });
  it.each([204, 304])("returns no payload for HTTP %s", async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status }),
    );
    expect(await apiRequest("/resource", { client, operation })).toMatchObject({
      status,
      data: undefined,
      kind: "documented",
    });
  });
  it("preserves JSON, text, binary and response headers", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response('{"id":1}', {
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("hello", { headers: { "content-type": "text/plain" } }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0, 255, 5]), {
          headers: {
            "content-type": "application/zip",
            "content-disposition": 'attachment; filename="survey.zip"',
          },
        }),
      );
    expect((await apiRequest("/json", { client, operation })).data).toEqual({
      id: 1,
    });
    expect((await apiRequest("/text", { client, operation })).data).toBe(
      "hello",
    );
    const binary = await apiRequest("/zip", { client, operation });
    expect(binary.data).toBeInstanceOf(Blob);
    expect(new Uint8Array(await (binary.data as Blob).arrayBuffer())).toEqual(
      new Uint8Array([0, 255, 5]),
    );
    expect(binary.headers.get("content-disposition")).toContain("survey.zip");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("retains a malformed JSON error status without pretending to return its DTO", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{broken", {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    expect(await apiRequest("/denied", { client, operation })).toMatchObject({
      status: 403,
      kind: "unexpected",
      data: "{broken",
    });
  });
  it("does not wait for or read a GIS denial body and omits cookies", async () => {
    const cancel = vi.fn(async () => {});
    const response = new Response(new ReadableStream({ cancel }), {
      status: 403,
      headers: { "content-type": "text/html" },
    });
    const read = vi.spyOn(response, "text");
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    expect(
      await apiRequest("/denied", {
        client,
        operation,
        responsePolicy: "status-first-json",
        cookiePolicy: "omit",
        redirect: "manual",
      }),
    ).toMatchObject({ status: 403, data: null, kind: "unexpected" });
    expect(read).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      credentials: "omit",
      redirect: "manual",
    });
  });
  it("preserves status-first denial when cancelling its body fails", async () => {
    const response = new Response(
      new ReadableStream({
        cancel() {
          throw new Error("stream cancellation failed");
        },
      }),
      { status: 503 },
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    expect(
      await apiRequest("/denied", {
        client,
        operation,
        responsePolicy: "status-first-json",
      }),
    ).toMatchObject({ status: 503, data: null, kind: "unexpected" });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("accepts a status-first denial without an available response stream", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 403 }),
    );
    expect(
      await apiRequest("/denied", {
        client,
        operation,
        responsePolicy: "status-first-json",
      }),
    ).toMatchObject({ status: 403, data: null, kind: "unexpected" });
  });
  it("rejects malformed success JSON with fixed text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("secret invalid JSON", {
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(apiRequest("/invalid", { client, operation })).rejects.toThrow(
      "The server returned invalid JSON.",
    );
  });

  it("never labels an empty JSON body as a documented DTO", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("", { headers: { "content-type": "application/json" } }),
      )
      .mockResolvedValueOnce(
        new Response("", {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      );
    await expect(apiRequest("/empty", { client, operation })).rejects.toThrow(
      "The server returned invalid JSON.",
    );
    expect(
      await apiRequest("/empty-error", { client, operation }),
    ).toMatchObject({ status: 403, kind: "unexpected", data: "" });
  });

  it("keeps empty text as a string and honors media ranges when decoding", async () => {
    const ranged: ApiOperationMetadata = {
      operationId: "range",
      responses: {
        "200": { content: { "*/*": "blob", "application/*": "text" } },
      },
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("", { headers: { "content-type": "text/plain" } }),
      )
      .mockResolvedValueOnce(
        new Response("<xml/>", {
          headers: { "content-type": "application/xml" },
        }),
      );
    expect(await apiRequest("/text", { client, operation })).toMatchObject({
      kind: "documented",
      data: "",
    });
    expect(
      await apiRequest("/xml", { client, operation: ranged }),
    ).toMatchObject({ kind: "documented", data: "<xml/>" });
  });
});
