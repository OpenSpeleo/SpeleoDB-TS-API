import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Read this package's reviewed schema snapshot without external dependencies. */
export async function loadOpenApiSchema(root) {
  const source = JSON.parse(
    await readFile(path.join(root, "openapi-source.json"), "utf8"),
  );
  if (
    source === null ||
    typeof source !== "object" ||
    Array.isArray(source) ||
    typeof source.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(source.sha256)
  ) {
    throw new Error("openapi-source.json requires a lowercase SHA-256.");
  }

  const bytes = await readFile(path.join(root, "OpenAPI.yaml"));
  if (bytes.length === 0) {
    throw new Error("The package OpenAPI schema is empty.");
  }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== source.sha256) {
    throw new Error(
      `Package OpenAPI SHA-256 mismatch: expected ${source.sha256}, received ${actual}. Review OpenAPI.yaml and update its digest before generating.`,
    );
  }
  return bytes;
}
