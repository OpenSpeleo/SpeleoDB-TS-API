import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadOpenApiSchema } from "../scripts/openapi-source.mjs";

const revision = "a".repeat(40);
const bytes = Buffer.from("remote producer bytes\r\nCafé 🦇\n");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const directories: string[] = [];
async function source(record: unknown = { revision, sha256 }) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "speleodb-remote-source-"),
  );
  directories.push(directory);
  await writeFile(
    path.join(directory, "openapi-source.json"),
    JSON.stringify(record),
  );
  vi.stubEnv("SPELEODB_OPENAPI_PATH", undefined);
  return directory;
}
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("pinned schema download boundary", () => {
  it("requests the immutable producer URL with redirect refusal and a bounded download, preserving exact bytes", async () => {
    const directory = await source();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetch = vi.fn(async () => new Response(bytes));
    vi.stubGlobal("fetch", fetch);
    expect(await loadOpenApiSchema(directory)).toEqual(bytes);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      `https://raw.githubusercontent.com/OpenSpeleo/SpeleoDB/${revision}/OpenAPI.yaml`,
      {
        redirect: "error",
        signal: expect.any(AbortSignal),
      },
    );
    expect(timeout).toHaveBeenCalledWith(30_000);
  });

  it.each([404, 429, 500])(
    "rejects HTTP %s instead of interpreting its body as a schema",
    async (status) => {
      const directory = await source();
      const response = new Response(bytes, { status });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response),
      );
      await expect(loadOpenApiSchema(directory)).rejects.toThrow(
        `HTTP ${status}`,
      );
      expect(response.bodyUsed).toBe(false);
    },
  );

  it.each(["redirect", "network", "deadline"])(
    "preserves %s rejection without retrying a mutable fallback",
    async (kind) => {
      const directory = await source();
      const failure =
        kind === "deadline"
          ? new DOMException("deadline", "TimeoutError")
          : new TypeError(kind);
      const fetch = vi.fn(async () => {
        throw failure;
      });
      vi.stubGlobal("fetch", fetch);
      await expect(loadOpenApiSchema(directory)).rejects.toBe(failure);
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ redirect: "error" }),
      );
    },
  );

  it("rejects a changed remote byte even when the URL is correctly pinned", async () => {
    const directory = await source();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(Buffer.concat([bytes, Buffer.from(" ")]))),
    );
    await expect(loadOpenApiSchema(directory)).rejects.toThrow(
      "Backend OpenAPI SHA-256 mismatch",
    );
  });

  it("rejects an empty remote response even with its matching SHA-256", async () => {
    const directory = await source({
      revision,
      sha256: createHash("sha256").update("").digest("hex"),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null)),
    );
    await expect(loadOpenApiSchema(directory)).rejects.toThrow(
      "schema is empty",
    );
  });

  it.each([
    null,
    [],
    "record",
    {},
    { revision },
    { sha256 },
    { revision, sha256: sha256.toUpperCase() },
    { revision: "master", sha256 },
    { revision: "a".repeat(39), sha256 },
    { revision, sha256: "0".repeat(63) },
  ])(
    "rejects malformed source record %# before any network request",
    async (record) => {
      const directory = await source(record);
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      await expect(loadOpenApiSchema(directory)).rejects.toThrow(
        "requires a lowercase SHA-256",
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
