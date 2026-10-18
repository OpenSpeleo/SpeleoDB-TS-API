import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Read the sole backend schema without storing another copy in this package. */
export async function loadOpenApiSchema(root) {
  const source = JSON.parse(
    await readFile(path.join(root, "openapi-source.json"), "utf8"),
  );
  if (
    source === null ||
    typeof source !== "object" ||
    typeof source.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(source.sha256) ||
    (source.revision !== null &&
      (typeof source.revision !== "string" ||
        !/^[a-f0-9]{40}$/.test(source.revision)))
  ) {
    throw new Error(
      "openapi-source.json requires a lowercase SHA-256 and a full backend commit revision (or null for unpublished local development).",
    );
  }

  const localPath = process.env.SPELEODB_OPENAPI_PATH;
  let bytes;
  if (localPath !== undefined) {
    if (!path.isAbsolute(localPath)) {
      throw new Error(
        "SPELEODB_OPENAPI_PATH must be an explicit absolute path.",
      );
    }
    bytes = await readFile(localPath);
  } else {
    if (source.revision === null) {
      throw new Error(
        "The backend schema revision is unpublished. Record its real upstream commit before remote generation or release; use an explicit SPELEODB_OPENAPI_PATH only for local maintenance.",
      );
    }
    const url = `https://raw.githubusercontent.com/OpenSpeleo/SpeleoDB/${source.revision}/OpenAPI.yaml`;
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(
        `Cannot download the pinned backend schema: HTTP ${response.status}.`,
      );
    }
    bytes = Buffer.from(await response.arrayBuffer());
  }

  if (bytes.length === 0)
    throw new Error("The backend OpenAPI schema is empty.");
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== source.sha256) {
    throw new Error(
      `Backend OpenAPI SHA-256 mismatch: expected ${source.sha256}, received ${actual}. Review the backend export and source pin before generating.`,
    );
  }
  return bytes;
}
