import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { apiRequest, createApiClient } from "./request";
import type { ApiOperationMetadata } from "./types";

const servers: Server[] = [];
const operation: ApiOperationMetadata = {
  operationId: "real-http-boundary",
  responses: {
    "200": { content: { "application/json": "json" } },
    "307": { content: {} },
  },
};

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(async (server) => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
      expect(server.listening).toBe(false);
      expect(server.address()).toBeNull();
    }),
  );
});

async function listen(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<string> {
  const server = createServer(handler);
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
    throw new Error("Expected an owned loopback TCP listener.");
  return `http://127.0.0.1:${address.port}`;
}

async function streamingServer(status = 200) {
  let received!: () => void;
  let closed!: () => void;
  const receiving = new Promise<void>((resolve) => {
    received = resolve;
  });
  const disconnected = new Promise<void>((resolve) => {
    closed = resolve;
  });
  const baseUrl = await listen((_request, response) => {
    response.on("close", closed);
    response.writeHead(status, { "Content-Type": "application/json" });
    response.write("{");
    received();
  });
  return { baseUrl, receiving, disconnected };
}

describe("real fetch transport", () => {
  it("returns a status-first denial and cancels its unfinished real HTTP body", async () => {
    const stream = await streamingServer(403);
    const client = createApiClient({ baseUrl: stream.baseUrl });
    const result = await apiRequest("/denied", {
      client,
      operation,
      responsePolicy: "status-first-json",
      cookiePolicy: "omit",
    });
    expect(result).toMatchObject({
      status: 403,
      data: null,
      kind: "unexpected",
    });
    await stream.disconnected;
  });

  it("enforces manual and error redirects without forwarding sensitive headers to another origin", async () => {
    let destinationRequests = 0;
    const destination = await listen((_request, response) => {
      destinationRequests++;
      response.writeHead(204).end();
    });
    const tokens: Array<string | undefined> = [];
    const baseUrl = await listen((request, response) => {
      tokens.push(request.headers["x-session-token"] as string | undefined);
      response.writeHead(307, { Location: `${destination}/receive` }).end();
    });
    const client = createApiClient({
      baseUrl,
      headers: { "X-Session-Token": "private-session" },
      credentials: "same-origin",
    });
    const manual = await apiRequest("/redirect", {
      client,
      operation,
      method: "POST",
      body: "private body",
      redirect: "manual",
    });
    expect(manual).toMatchObject({
      status: 307,
      data: undefined,
      kind: "documented",
    });
    await expect(
      apiRequest("/redirect", {
        client,
        operation,
        method: "POST",
        body: "private body",
        redirect: "error",
      }),
    ).rejects.toThrow();
    expect(tokens).toEqual(["private-session", "private-session"]);
    expect(destinationRequests).toBe(0);
  });

  it("enforces the overall deadline while consuming an unfinished HTTP body", async () => {
    const stream = await streamingServer();
    const client = createApiClient({
      baseUrl: stream.baseUrl,
      timeoutMs: 1000,
    });
    const pending = apiRequest("/stream", { client, operation });
    const rejected = expect(pending).rejects.toMatchObject({
      name: "TimeoutError",
    });
    await stream.receiving;
    await rejected;
    await stream.disconnected;
  });

  it("preserves caller cancellation and closes an actual in-flight response stream", async () => {
    const stream = await streamingServer();
    const controller = new AbortController();
    const reason = new Error("caller cancelled body consumption");
    const client = createApiClient({
      baseUrl: stream.baseUrl,
      timeoutMs: null,
    });
    const pending = apiRequest("/stream", {
      client,
      operation,
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toBe(reason);
    await stream.receiving;
    controller.abort(reason);
    await rejected;
    await stream.disconnected;
  });
});
