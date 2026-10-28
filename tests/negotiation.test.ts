import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  createApiClient,
  v2ProjectsDownloadRetrieveByFormat,
} from "../src/index";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(async (server) => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    }),
  );
});

async function renderer(status: number, data: string | Uint8Array = "") {
  const received: string[] = [];
  const server = createServer((request, response) => {
    const accept = request.headers.accept ?? "*/*";
    received.push(accept);
    // JSON and browsable HTML negotiation precede endpoint handling.
    // The live suite separately exercises the actual DRF server.
    const acceptable = accept
      .split(",")
      .some((media) =>
        [
          "application/json",
          "application/*",
          "text/html",
          "text/*",
          "*/*",
        ].includes(media.split(";")[0]!.trim()),
      );
    if (!acceptable) {
      response.writeHead(406, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          detail: "Could not satisfy the request Accept header.",
        }),
      );
      return;
    }
    response.writeHead(status, {
      "Content-Type":
        status === 200 ? "application/octet-stream" : "application/json",
      ...(status === 302
        ? { Location: "https://storage.example.invalid/project.zip" }
        : {}),
    });
    response.end(data);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected TCP address");
  return {
    client: createApiClient({ baseUrl: `http://127.0.0.1:${address.port}` }),
    received,
  };
}

describe("download renderer negotiation", () => {
  it.each([
    [undefined, 302],
    ["application/octet-stream", 406],
    ["application/xml", 406],
    ["text/plain", 406],
    ["text/html", 302],
    ["text/*", 302],
    ["application/json", 302],
    ["application/json; indent=4", 302],
    ["application/octet-stream, application/json", 302],
    ["application/*", 302],
    ["*/*", 302],
    // DRF intentionally ignores quality values when selecting a renderer.
    ["application/octet-stream;q=1, application/json;q=0", 302],
  ] as const)("negotiates %s before the redirect", async (accept, expected) => {
    const fixture = await renderer(302);
    const response = await v2ProjectsDownloadRetrieveByFormat(
      "project",
      "compass_zip",
      undefined,
      {
        client: fixture.client,
        redirect: "manual",
        ...(accept ? { headers: { aCcEpT: accept } } : {}),
      },
    );
    expect(response.status).toBe(expected);
    if (expected === 302)
      expect(response.headers.get("location")).toBe(
        "https://storage.example.invalid/project.zip",
      );
    else
      expect(response.data).toEqual({
        detail: "Could not satisfy the request Accept header.",
      });
    expect(fixture.received).toEqual([accept ?? "*/*"]);
  });

  it.each([400, 403, 404, 422, 500])(
    "keeps endpoint error %i instead of masking it with 406",
    async (status) => {
      const fixture = await renderer(
        status,
        JSON.stringify({ error: "endpoint error" }),
      );
      const response = await v2ProjectsDownloadRetrieveByFormat(
        "project",
        "compass_zip",
        undefined,
        {
          client: fixture.client,
          redirect: "manual",
        },
      );
      expect(response.status).toBe(status);
      expect(response.data).toEqual({ error: "endpoint error" });
    },
  );

  it("decodes direct binary success after the renderer gate", async () => {
    const fixture = await renderer(200, new Uint8Array([0x50, 0x4b, 0, 255]));
    const response = await v2ProjectsDownloadRetrieveByFormat(
      "project",
      "compass_zip",
      undefined,
      {
        client: fixture.client,
        redirect: "manual",
      },
    );
    expect(response.status).toBe(200);
    expect(response.data).toBeInstanceOf(Blob);
    expect(new Uint8Array(await (response.data as Blob).arrayBuffer())).toEqual(
      new Uint8Array([0x50, 0x4b, 0, 255]),
    );
  });
});
