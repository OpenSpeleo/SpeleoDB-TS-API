import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  formMutators,
  operationOverrides,
} from "../scripts/openapi-metadata.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function generatedMultipart(schema: unknown) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "speleodb-form-policy-test-"),
  );
  temporary.push(directory);
  await mkdir(path.join(directory, "runtime"));
  await copyFile(
    path.join(root, "src/runtime/form-data.ts"),
    path.join(directory, "runtime/form-data.ts"),
  );
  const destination = path.join(directory, "forms.ts");
  await writeFile(
    destination,
    formMutators({
      paths: {
        "/resources/": {
          post: {
            operationId: "create_resource",
            requestBody: { content: { "multipart/form-data": { schema } } },
            responses: {},
          },
        },
      },
    }),
  );
  const generated = (await import(pathToFileURL(destination).href)) as {
    create_resourceMultipart(body: object): FormData;
  };
  return generated.create_resourceMultipart;
}

describe("schema-derived generation metadata", () => {
  it.each([false, true])(
    "preserves note null clears beside required uploaded files, reverse=%s",
    async (reverse) => {
      const members = [
        {
          type: "object",
          properties: {
            resource_type: { type: "string", enum: ["note"] },
            file: {
              type: "string",
              nullable: true,
              enum: [null],
              "x-drf-null-as-empty": true,
            },
          },
        },
        {
          type: "object",
          required: ["file"],
          properties: {
            resource_type: { type: "string", enum: ["document"] },
            file: { type: "string", format: "binary" },
          },
        },
      ];
      const serialize = await generatedMultipart({
        anyOf: reverse ? members.toReversed() : members,
      });
      const note = serialize({ resource_type: "note", file: null });
      expect([...note.entries()]).toEqual([
        ["resource_type", "note"],
        ["file", ""],
      ]);
      const file = new File([new Uint8Array([0, 255, 128])], "survey.dat", {
        type: "application/octet-stream",
      });
      const uploaded = serialize({ resource_type: "document", file });
      const actual = uploaded.get("file") as File;
      expect(actual.name).toBe(file.name);
      expect(new Uint8Array(await actual.arrayBuffer())).toEqual(
        new Uint8Array(await file.arrayBuffer()),
      );
      expect(() => serialize({ unknown: null })).toThrow(
        "cannot represent null",
      );
    },
  );

  it("keeps decoded JSON metadata informational while transporting a text form part", async () => {
    const serialize = await generatedMultipart({
      type: "object",
      properties: {
        data: {
          type: "string",
          "x-json-schema": {
            type: "object",
            properties: { name: { type: "string" } },
          },
        },
      },
    });
    const text = JSON.stringify({ name: "Café 🦇", nested: [null, false, 0] });
    const form = serialize({ data: text });
    expect(form.get("data")).toBe(text);
    expect(typeof form.get("data")).toBe("string");
  });

  it("declares opaque wildcard streams and actual HTML errors independently of JSON responses", () => {
    const overrides = operationOverrides({
      paths: {
        "/git/{project}/": {
          post: {
            operationId: "git_upload_pack",
            requestBody: {
              content: {
                "application/x-git-upload-pack-request": {
                  schema: { type: "string", format: "binary" },
                },
                "application/octet-stream": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            responses: {
              "200": {
                content: {
                  "*/*": { schema: { type: "string", format: "binary" } },
                },
              },
              "403": {
                content: {
                  "text/html": { schema: { type: "string" } },
                  "application/json": { schema: { type: "object" } },
                },
              },
            },
          },
        },
      },
    });
    expect(overrides.git_upload_pack?.requestOptions.operation).toEqual({
      operationId: "git_upload_pack",
      responses: {
        "200": { content: { "*/*": "blob" } },
        "403": { content: { "text/html": "text", "application/json": "json" } },
      },
    });
    expect(overrides.git_upload_pack?.formData).toBeUndefined();
    expect(overrides.git_upload_pack?.formUrlEncoded).toBeUndefined();
  });
});
