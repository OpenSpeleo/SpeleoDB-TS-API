// Explicit read-only checks against the real staging renderer, separate from
// deterministic coverage: bun run test:stage. Missing secrets always fail.
import { describe, expect, it } from "vitest";
import {
  createApiClient,
  v2GisLayersSourceRetrieve,
  v2ProjectRetrieve,
  v2ProjectsDownloadBlobRetrieve,
  v2ProjectsDownloadRetrieveByFormat,
  v2ProjectsDownloadRetrieveByFormatAtHash,
  v2ProjectsList,
  v2UserAuthTokenRetrieve,
} from "../src/index";
import type { Project } from "../src/index";

function required(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Required staging secret: ${name}`);
  return value;
}
const instance = required("TEST_SPELEODB_INSTANCE");
const origin = new URL(instance);
if (
  origin.protocol !== "https:" ||
  origin.hostname.toLowerCase() !== "stage.speleodb.org" ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
) {
  throw new Error("Live negotiation tests require the staging HTTPS origin");
}
const token = required("TEST_SPELEODB_OAUTH");
const populated = required("TEST_SPELEODB_PROJECT_ID");
const empty = required("TEST_SPELEODB_EMPTY_PROJECT_ID");
const layer = required("TEST_SPELEODB_GIS_LAYER_ID");
const client = createApiClient({
  baseUrl: instance,
  headers: { Authorization: `Token ${token}` },
  timeoutMs: 30_000,
});
const options = {
  client,
  redirect: "manual" as const,
  credentials: "omit" as const,
};

describe("actual stage renderer negotiation", () => {
  it("validates JSON operations and the complete relevant Accept matrix", async () => {
    const auth = await v2UserAuthTokenRetrieve(undefined, options);
    // Assert only status; failure output must never print a token response.
    expect(auth.status).toBe(200);
    const projects = await v2ProjectsList(undefined, options);
    expect(projects.status).toBe(200);
    for (const [accept, expected] of [
      [undefined, 200],
      ["application/octet-stream", 406],
      ["application/xml", 406],
      ["text/plain", 406],
      ["text/html", 200],
      ["text/*", 200],
      ["application/json", 200],
      ["application/json; indent=4", 200],
      ["application/octet-stream, application/json", 200],
      ["application/*", 200],
      ["*/*", 200],
      // DRF intentionally ignores quality values when selecting its renderer.
      ["application/octet-stream;q=1, application/json;q=0", 200],
    ] as const) {
      const response = await v2ProjectsDownloadRetrieveByFormat(
        populated,
        "compass_zip",
        undefined,
        {
          ...options,
          ...(accept ? { headers: { aCcEpT: accept } } : {}),
        },
      );
      expect(response.status, `Accept ${accept ?? "fetch default"}`).toBe(
        expected,
      );
      if (expected === 200) {
        expect(response.data).toBeInstanceOf(Blob);
        const bytes = new Uint8Array(
          await (response.data as Blob).arrayBuffer(),
        );
        expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
      }
    }
  });

  it("uses actual renderer specificity/order and format filtering", async () => {
    const filtered = await v2ProjectsDownloadRetrieveByFormat(
      populated,
      "compass_zip",
      { format: "json" },
      {
        ...options,
        headers: { Accept: "text/html" },
      },
    );
    expect(filtered.status).toBe(406);
    for (const [accept, media] of [
      ["text/html, */*", "text/html"],
      ["text/*, application/json", "application/json"],
      ["application/json;q=0, text/html;q=1", "application/json"],
      ["text/html;level=1, application/json", "text/html"],
    ]) {
      const response = await v2ProjectsDownloadRetrieveByFormat(
        "00000000-0000-0000-0000-000000000000",
        "compass_zip",
        undefined,
        {
          ...options,
          headers: { Accept: accept! },
        },
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")?.startsWith(media!)).toBe(
        true,
      );
    }
  });

  it("preserves authentication, not-found and empty-project statuses instead of 406", async () => {
    const missing = await v2ProjectsDownloadRetrieveByFormat(
      "00000000-0000-0000-0000-000000000000",
      "compass_zip",
      undefined,
      options,
    );
    expect(missing.status).toBe(404);
    const noData = await v2ProjectsDownloadRetrieveByFormat(
      empty,
      "compass_zip",
      undefined,
      options,
    );
    expect(noData.status).toBe(422);
    const rejected = await v2ProjectsDownloadRetrieveByFormat(
      populated,
      "compass_zip",
      undefined,
      {
        ...options,
        client: createApiClient({
          baseUrl: instance,
          headers: { Authorization: "Token invalid-sdk-negotiation-token" },
          timeoutMs: 30_000,
        }),
      },
    );
    expect([401, 403]).toContain(rejected.status);
  });

  it("downloads actual revision/blob bytes and follows signed GIS storage anonymously", async () => {
    const result = await v2ProjectRetrieve(populated, undefined, options);
    expect(result.status).toBe(200);
    const project = result.data as Project;
    const commit = project.latest_commit;
    if (!commit || typeof commit !== "object")
      throw new Error("Populated fixture must have a commit");
    const revision = await v2ProjectsDownloadRetrieveByFormatAtHash(
      populated,
      "compass_zip",
      commit.id,
      undefined,
      options,
    );
    expect(revision.status).toBe(200);
    expect(revision.data).toBeInstanceOf(Blob);
    const blob = commit.tree.find((entry) => entry.type === "blob");
    if (!blob) throw new Error("Fixture must have a Git blob");
    const artifact = await v2ProjectsDownloadBlobRetrieve(
      populated,
      blob.object,
      undefined,
      options,
    );
    expect(artifact.status).toBe(200);
    expect(artifact.data).toBeInstanceOf(Blob);
    expect((artifact.data as Blob).size).toBeGreaterThan(0);
    const handoff = await v2GisLayersSourceRetrieve(layer, undefined, options);
    expect(handoff.status).toBe(302);
    const location = handoff.headers.get("location");
    if (!location) throw new Error("Expected signed source Location");
    // No API client, Authorization header or cookies cross the handoff.
    const source = await fetch(location, {
      credentials: "omit",
      signal: AbortSignal.timeout(30_000),
    }).catch(() => {
      throw new Error("Signed source request failed");
    });
    expect(source.status).toBe(200);
    const text = await source.text().catch(() => {
      throw new Error("Signed source body failed");
    });
    expect(text).toContain("SDK fixture");
  });
});
