import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as api from "../src/index";
import * as generated from "../src/generated/operations";
import type {
  ApiOperationMetadata,
  ApiResponse,
  ApiRequestOptions,
} from "../src/index";
import {
  argumentsFor,
  concreteMedia,
  operations,
  permitsEmptyNull,
  responses,
  variants,
} from "./contract-cases";
import type { Codec, ResponseCase, Variant } from "./contract-cases";

interface Received {
  method: string;
  url: string;
  headers: Headers;
  bytes: Buffer;
}
interface Reply {
  status: number;
  media: string | undefined;
  codec: Codec;
}
interface Exchange {
  reply: Reply;
  receive: (request: Received) => void;
  fail: (error: unknown) => void;
}
const pending = new Map<string, Exchange>();
const unknownRequests: string[] = [];
let nextId = 0;
let origin: string;
const jsonWitness = {
  transportWitness: "Café 🦇",
  count: 0,
  enabled: false,
  nested: [null, 3],
};
const textWitness = "transport witness: Café 🦇\n";
const binaryWitness = Buffer.from([0, 255, 128, 1, 13, 10]);
const server = createServer((request, response) => {
  const id = String(request.headers["x-contract-case"]);
  const exchange = pending.get(id);
  if (!exchange) {
    unknownRequests.push(id);
    response.writeHead(500).end("Unknown test exchange");
    return;
  }
  void (async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of request)
      chunks.push(Buffer.from(chunk as Uint8Array));
    const headers = new Headers();
    for (let index = 0; index < request.rawHeaders.length; index += 2)
      headers.append(
        request.rawHeaders[index]!,
        request.rawHeaders[index + 1]!,
      );
    exchange.receive({
      method: request.method!,
      url: request.url!,
      headers,
      bytes: Buffer.concat(chunks),
    });
    const reply = exchange.reply;
    response.statusCode = reply.status;
    response.setHeader("X-Contract-Response", "received");
    if (reply.media)
      response.setHeader("Content-Type", `${reply.media}; charset=utf-8`);
    const body =
      reply.codec === "json"
        ? JSON.stringify(jsonWitness)
        : reply.codec === "text"
          ? textWitness
          : reply.codec === "blob"
            ? binaryWitness
            : undefined;
    response.end(body);
  })().catch((error: unknown) => {
    exchange.fail(error);
    response.writeHead(500).end("Test server failed");
  });
});
beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
  expect(server.listening).toBe(false);
  expect(server.address()).toBeNull();
  expect(pending.size).toBe(0);
  expect(unknownRequests).toEqual([]);
});

async function exchange(
  variant: Variant,
  reply: Reply,
  omitOptionalQuery = false,
) {
  const id = String(++nextId);
  let resolveRequest!: (value: Received) => void;
  let rejectRequest!: (error: unknown) => void;
  let receivedCount = 0;
  let transportCount = 0;
  const received = new Promise<Received>((resolve, reject) => {
    resolveRequest = (request) => {
      receivedCount++;
      resolve(request);
    };
    rejectRequest = reject;
  });
  // Own an early server rejection even if a signature/body adapter throws.
  void received.catch(() => {});
  try {
    pending.set(id, { reply, receive: resolveRequest, fail: rejectRequest });
    const input = argumentsFor(variant, omitOptionalQuery);
    let metadata: ApiOperationMetadata | undefined;
    const client = api.createApiClient({
      baseUrl: origin,
      transport: async (request) => {
        transportCount++;
        metadata = request.operation;
        return api.fetchTransport(request);
      },
    });
    const operation = (api as unknown as Record<string, unknown>)[variant.name];
    if (typeof operation !== "function")
      throw new Error(`Missing public operation: ${variant.name}`);
    // Orval's positional adapter is deliberately strict: new signature shapes fail.
    expect(operation.length, variant.name).toBe(input.args.length + 1);
    const invoke = operation as (...args: unknown[]) => Promise<ApiResponse>;
    const options: ApiRequestOptions = {
      client,
      headers: { ...input.headers, "x-contract-case": id },
    };
    const [result, request] = await Promise.all([
      invoke(...input.args, options),
      received,
    ]);
    expect(transportCount).toBe(1);
    expect(receivedCount).toBe(1);
    return { result, request, metadata, input };
  } finally {
    pending.delete(id);
  }
}

function representative(variant: Variant): ResponseCase {
  return (
    variant.operation.responses.find(
      (response) => response.status >= 200 && response.status < 300,
    ) ?? variant.operation.responses[0]!
  );
}

async function assertDecoded(
  result: ApiResponse,
  reply: Reply,
  kind: "documented" | "unexpected",
) {
  expect(result.status).toBe(reply.status);
  expect(result.kind).toBe(kind);
  expect(result.headers.get("x-contract-response")).toBe("received");
  if ([204, 205, 304].includes(reply.status) || reply.codec === "empty") {
    expect(result.data).toBeUndefined();
  } else if (reply.codec === "json") {
    expect(result.data).toEqual(jsonWitness);
  } else if (reply.codec === "text") {
    expect(result.data).toBe(textWitness);
  } else {
    expect(result.data).toBeInstanceOf(Blob);
    expect(Buffer.from(await (result.data as Blob).arrayBuffer())).toEqual(
      binaryWitness,
    );
  }
}

/** Read actual part headers; Bun's formData parser infers MIME from filenames. */
function multipartTypes(
  request: Received,
): Map<string, Array<string | undefined>> {
  const header = request.headers.get("content-type")!;
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(header);
  if (!boundary) throw new Error("Multipart request has no boundary");
  const parts = request.bytes
    .toString("latin1")
    .split(`--${boundary[1] ?? boundary[2]}`);
  expect(parts[0]).toBe("");
  expect(parts.at(-1)).toMatch(/^--(?:\r\n)?$/);
  const types = new Map<string, Array<string | undefined>>();
  for (const part of parts.slice(1, -1)) {
    expect(part.startsWith("\r\n")).toBe(true);
    const separator = part.indexOf("\r\n\r\n");
    expect(separator).toBeGreaterThan(0);
    const headers = part.slice(2, separator).split("\r\n");
    const disposition = headers.find((line) =>
      /^content-disposition:/i.test(line),
    );
    const name = disposition && /; name="([^"]+)"/.exec(disposition)?.[1];
    if (!name) throw new Error("Unrecognized multipart field header");
    const type = headers
      .find((line) => /^content-type:/i.test(line))
      ?.split(":")
      .slice(1)
      .join(":")
      .trim();
    types.set(name, [...(types.get(name) ?? []), type]);
  }
  return types;
}

async function assertBody(request: Received, body: unknown, variant: Variant) {
  const media = variant.media;
  if (!media) {
    expect(request.bytes.byteLength).toBe(0);
    return;
  }
  expect(request.headers.get("content-type")?.split(";")[0]).toBe(
    concreteMedia(media),
  );
  if (media === "application/json") {
    expect(JSON.parse(request.bytes.toString("utf8"))).toEqual(body);
    return;
  }
  if (media !== "multipart/form-data" && body instanceof Blob) {
    expect(new Uint8Array(request.bytes)).toEqual(
      new Uint8Array(await body.arrayBuffer()),
    );
    return;
  }
  const entries =
    media === "multipart/form-data"
      ? [
          ...(
            await new Response(new Uint8Array(request.bytes), {
              headers: request.headers,
            }).formData()
          ).entries(),
        ]
      : [...new URLSearchParams(request.bytes.toString("utf8")).entries()];
  if (media === "multipart/form-data")
    expect(request.headers.get("content-type")).toMatch(/; boundary=.+/);
  const wireTypes =
    media === "multipart/form-data" ? multipartTypes(request) : undefined;
  const expected = Object.entries(body as Record<string, unknown>).flatMap(
    ([name, value]) =>
      (Array.isArray(value) ? value : [value])
        .filter((item) => item !== undefined)
        .map((item) => [name, item] as const),
  );
  expect(entries.map(([name]) => name).sort()).toEqual(
    expected.map(([name]) => name).sort(),
  );
  // Field order is not significant; repeated values within one field retain order.
  for (const name of new Set(expected.map(([name]) => name))) {
    const wanted = expected
      .filter(([field]) => field === name)
      .map(([, value]) => value);
    const values = entries
      .filter(([field]) => field === name)
      .map(([, value]) => value);
    for (let index = 0; index < wanted.length; index++) {
      const value = wanted[index];
      const actual = values[index];
      if (value instanceof File) {
        expect(actual).toBeInstanceOf(File);
        expect((actual as File).name).toBe(value.name);
        expect(wireTypes?.get(name)?.[index]).toBe(value.type);
        expect(new Uint8Array(await (actual as File).arrayBuffer())).toEqual(
          new Uint8Array(await value.arrayBuffer()),
        );
      } else {
        if (value === null) {
          expect(permitsEmptyNull(variant.schema ?? {}, name)).toBe(true);
          expect(actual).toBe("");
          continue;
        }
        expect(actual).toBe(
          typeof value === "object" ? JSON.stringify(value) : String(value),
        );
      }
    }
  }
}

function assertUrl(
  variant: Variant,
  request: Received,
  input: ReturnType<typeof argumentsFor>,
) {
  let path = variant.operation.path;
  variant.operation.pathParameters.forEach((parameter, index) => {
    path = path.replace(
      `{${parameter.name}}`,
      encodeURIComponent(input.paths[index]!),
    );
  });
  const url = new URL(request.url, origin);
  expect(url.pathname).toBe(path);
  const expected: Array<[string, string]> = [];
  for (const parameter of variant.operation.queryParameters) {
    const value = input.query[parameter.name];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      // OpenAPI form query parameters default to explode=true, unless explicit.
      if (parameter.explode !== false)
        value.forEach((item) => expected.push([parameter.name, String(item)]));
      else expected.push([parameter.name, value.join(",")]);
    } else expected.push([parameter.name, String(value)]);
  }
  expect([...url.searchParams.entries()]).toEqual(expected);
}

describe("canonical OpenAPI inventory and generated wire behavior", () => {
  it("covers every canonical operation, callable media variant and status/media declaration", () => {
    expect(operations).toHaveLength(376);
    expect(variants).toHaveLength(584);
    expect(responses).toHaveLength(1868);
    expect(new Set(operations.map((operation) => operation.id)).size).toBe(
      operations.length,
    );
    expect(new Set(variants.map((variant) => variant.name)).size).toBe(
      variants.length,
    );
    const exports = Object.entries(generated).filter(
      ([name, value]) =>
        typeof value === "function" && !/^get.+Url$/.test(name),
    );
    expect(exports.map(([name]) => name).sort()).toEqual(
      variants.map((variant) => variant.name).sort(),
    );
    for (const [name, operation] of exports)
      expect((api as Record<string, unknown>)[name]).toBe(operation);
  });

  it.each(variants)(
    "$name sends canonical $media bytes and complete response metadata",
    async (variant) => {
      const { request, metadata, input, result } = await exchange(
        variant,
        representative(variant),
      );
      expect(request.method).toBe(variant.operation.method);
      assertUrl(variant, request, input);
      for (const [name, value] of Object.entries(input.headers))
        expect(request.headers.get(name)).toBe(value);
      await assertBody(request, input.body, variant);
      expect(metadata).toEqual(variant.operation.metadata);
      await assertDecoded(result, representative(variant), "documented");
    },
  );

  it.each(
    variants.filter((variant) =>
      variant.operation.queryParameters.some(
        (parameter) => !parameter.required,
      ),
    ),
  )(
    "$name omits optional undefined query values on the actual wire",
    async (variant) => {
      const { request, input } = await exchange(
        variant,
        representative(variant),
        true,
      );
      assertUrl(variant, request, input);
    },
  );

  it.each(responses)(
    "$label decodes and classifies a real HTTP response",
    async (response) => {
      const { result } = await exchange(
        response.operation.variants[0]!,
        response,
      );
      await assertDecoded(result, response, "documented");
    },
  );

  it.each(responses.filter((response) => response.declaredMedia === "*/*"))(
    "$label preserves opaque bytes under concrete JSON and text media types",
    async (response) => {
      for (const media of ["application/json", "text/plain"]) {
        const reply = { ...response, media };
        const { result } = await exchange(
          response.operation.variants[0]!,
          reply,
        );
        await assertDecoded(result, reply, "documented");
      }
    },
  );

  it.each(operations)(
    "$id preserves undeclared HTTP status without claiming a DTO",
    async (operation) => {
      expect(operation.metadata.responses[599]).toBeUndefined();
      const reply: Reply = {
        status: 599,
        media: "application/json",
        codec: "json",
      };
      const { result } = await exchange(operation.variants[0]!, reply);
      await assertDecoded(result, reply, "unexpected");
    },
  );

  it.each(operations)(
    "$id rejects an undeclared media type at a declared status",
    async (operation) => {
      const status = operation.responses.find((response) => {
        const content =
          operation.metadata.responses[String(response.status)]!.content;
        return (
          ![204, 205, 304].includes(response.status) &&
          !("*/*" in content) &&
          !("application/*" in content) &&
          !("application/x-contract-witness" in content)
        );
      })?.status;
      if (status === undefined)
        throw new Error(
          `No response permitting a body mismatch witness: ${operation.id}`,
        );
      const reply: Reply = {
        status,
        media: "application/x-contract-witness",
        codec: "blob",
      };
      const { result } = await exchange(operation.variants[0]!, reply);
      await assertDecoded(result, reply, "unexpected");
    },
  );
});
