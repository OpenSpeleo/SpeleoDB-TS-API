import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadOpenApiSchema } from "../scripts/openapi-source.mjs";

const bytes = Buffer.from("package schema bytes\r\nCafé 🦇\n");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const directories: string[] = [];
async function source(record: unknown = { sha256 }, snapshot = bytes) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "speleodb-schema-snapshot-"),
  );
  directories.push(directory);
  await writeFile(
    path.join(directory, "openapi-source.json"),
    JSON.stringify(record),
  );
  await writeFile(path.join(directory, "OpenAPI.yaml"), snapshot);
  return directory;
}
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("package schema integrity", () => {
  it("reads the package snapshot with only its checksum metadata", async () => {
    const directory = await source();
    expect(await loadOpenApiSchema(directory)).toEqual(bytes);
  });

  it("rejects a changed snapshot", async () => {
    const directory = await source(
      { sha256 },
      Buffer.concat([bytes, Buffer.from(" ")]),
    );
    await expect(loadOpenApiSchema(directory)).rejects.toThrow(
      "Package OpenAPI SHA-256 mismatch",
    );
  });

  it("rejects an empty snapshot even with its matching checksum", async () => {
    const directory = await source(
      { sha256: createHash("sha256").update("").digest("hex") },
      Buffer.alloc(0),
    );
    await expect(loadOpenApiSchema(directory)).rejects.toThrow(
      "schema is empty",
    );
  });

  it.each(
    [
      null,
      [],
      "record",
      {},
      { sha256: null },
      { sha256: 42 },
      { sha256: sha256.toUpperCase() },
      { sha256: "0".repeat(63) },
    ].map((record) => [record]),
  )("rejects malformed checksum metadata %#", async (record) => {
    const directory = await source(record);
    await expect(loadOpenApiSchema(directory)).rejects.toThrow(
      "requires a lowercase SHA-256",
    );
  });
});
