import { fileURLToPath } from "node:url";
import { loadOpenApiSchema } from "../scripts/openapi-source.mjs";
import type { ApiOperationMetadata } from "../src/index";

// Bun is the pinned runtime; its YAML parser avoids another schema dependency.
declare const Bun: { YAML: { parse(text: string): unknown } };

export interface Schema {
  $ref?: string;
  type?: string | string[];
  format?: string;
  properties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  items?: Schema;
  allOf?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  enum?: unknown[];
  const?: unknown;
  readOnly?: boolean;
  minItems?: number;
  maxItems?: number;
  "x-json-schema"?: Schema;
  "x-drf-null-as-empty"?: boolean;
}
interface Parameter {
  $ref?: string;
  name: string;
  in: string;
  required?: boolean;
  style?: string;
  explode?: boolean;
  schema: Schema;
}
interface Media {
  schema?: Schema;
  encoding?: unknown;
}
interface Content {
  $ref?: string;
  content?: Record<string, Media>;
}
interface Operation {
  operationId: string;
  parameters?: Parameter[];
  requestBody?: Content;
  responses: Record<string, Content>;
}
interface PathItem {
  parameters?: Parameter[];
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  head?: Operation;
  options?: Operation;
  trace?: Operation;
}
interface Document {
  paths: Record<string, PathItem>;
}

const document = Bun.YAML.parse(
  (
    await loadOpenApiSchema(fileURLToPath(new URL("..", import.meta.url)))
  ).toString("utf8"),
) as Document;

export function resolve<T extends { $ref?: string }>(value: T): T {
  if (!value.$ref) return value;
  if (!value.$ref.startsWith("#/"))
    throw new Error(`External reference: ${value.$ref}`);
  let target: unknown = document;
  for (const part of value.$ref.slice(2).split("/")) {
    if (!target || typeof target !== "object")
      throw new Error(`Invalid reference: ${value.$ref}`);
    target = (target as Record<string, unknown>)[
      part.replace(/~1/g, "/").replace(/~0/g, "~")
    ];
  }
  if (!target || typeof target !== "object")
    throw new Error(`Missing reference: ${value.$ref}`);
  const siblings = { ...value };
  delete siblings.$ref;
  return { ...resolve(target as T), ...siblings };
}

export type Codec = "json" | "text" | "blob" | "empty";
export interface Variant {
  name: string;
  media: string | undefined;
  schema: Schema | undefined;
  operation: ContractOperation;
}
export interface ContractOperation {
  id: string;
  method: string;
  path: string;
  pathParameters: Parameter[];
  queryParameters: Parameter[];
  headerParameters: Parameter[];
  metadata: ApiOperationMetadata;
  variants: Variant[];
  responses: ResponseCase[];
}
export interface ResponseCase {
  operation: ContractOperation;
  status: number;
  media: string | undefined;
  declaredMedia: string | undefined;
  codec: Codec;
  label: string;
}

// Test oracle: standard MIME semantics and the schema's explicit binary marker.
// No production metadata projector or generated route list is imported here.
function codec(
  media: string,
  schema: Schema | undefined,
): Exclude<Codec, "empty"> {
  const value = schema ? resolve(schema) : undefined;
  if (value?.format === "binary") return "blob";
  const subtype = media.toLowerCase().split("/")[1];
  if (subtype?.endsWith("json")) return "json";
  if (media.startsWith("text/") || value?.type === "string") return "text";
  return "blob";
}
const suffixes: Record<string, string> = {
  "application/json": "WithJson",
  "application/x-www-form-urlencoded": "WithUrlEncoded",
  "multipart/form-data": "WithFormData",
  "application/octet-stream": "WithBlob",
  "application/x-git-upload-pack-request": "WithXGitUploadPackRequest",
  "application/x-git-receive-pack-request": "WithXGitReceivePackRequest",
  "*/*": "WithContent",
};

/** A response Content-Type is concrete even when OpenAPI permits a MIME range. */
export function concreteMedia(media: string | undefined): string | undefined {
  if (media === "*/*") return "application/x-contract-binary";
  if (media?.endsWith("/*")) {
    const family = media.slice(0, -1);
    return family + (family === "text/" ? "plain" : "x-contract-binary");
  }
  return media;
}
const methods = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
] as const;
export const operations: ContractOperation[] = [];
for (const [path, item] of Object.entries(document.paths)) {
  // Independent scope oracle: only SpeleoDB's obsolete mount is excluded.
  // Authentication v1 and unrelated names such as /api/v10 remain in scope.
  if (path === "/api/v1" || path.startsWith("/api/v1/")) continue;
  for (const method of methods) {
    const original = item[method];
    if (!original) continue;
    const parameters = [
      ...(item.parameters ?? []),
      ...(original.parameters ?? []),
    ].map(resolve);
    for (const parameter of parameters) {
      if (
        !["path", "query", "header"].includes(parameter.in) ||
        (parameter.style !== undefined &&
          !(parameter.in === "query" && parameter.style === "form")) ||
        (parameter.explode !== undefined &&
          !(parameter.in === "query" && typeof parameter.explode === "boolean"))
      )
        throw new Error(
          `Extend the wire oracle for ${original.operationId}: ${JSON.stringify(parameter)}`,
        );
    }
    const pathNames = [...path.matchAll(/\{([^}]+)\}/g)].map(
      (match) => match[1]!,
    );
    const pathParameters = pathNames.map((name) => {
      const parameter = parameters.find(
        (candidate) => candidate.in === "path" && candidate.name === name,
      );
      if (!parameter) throw new Error(`Missing path parameter ${name}`);
      return parameter;
    });
    if (
      pathParameters.length !==
      parameters.filter((parameter) => parameter.in === "path").length
    )
      throw new Error(`Unmatched path parameter in ${original.operationId}`);
    const operation: ContractOperation = {
      id: original.operationId,
      method: method.toUpperCase(),
      path,
      pathParameters,
      queryParameters: parameters.filter(
        (parameter) => parameter.in === "query",
      ),
      headerParameters: parameters.filter(
        (parameter) => parameter.in === "header",
      ),
      metadata: { operationId: original.operationId, responses: {} },
      variants: [],
      responses: [],
    };
    const content = original.requestBody
      ? (resolve(original.requestBody).content ?? {})
      : {};
    const representations = Object.entries(content);
    if (original.requestBody && representations.length === 0)
      throw new Error(`Unrepresented body: ${operation.id}`);
    for (const [media, representation] of representations.length
      ? representations
      : ([[undefined, undefined]] as const)) {
      if (
        media &&
        (!(media in suffixes) || representation?.encoding !== undefined)
      )
        throw new Error(`Extend the body oracle for ${operation.id}: ${media}`);
      const baseName = operation.id.replace(
        /_([a-z0-9])/g,
        (_, letter: string) => letter.toUpperCase(),
      );
      operation.variants.push({
        name: baseName + (representations.length > 1 ? suffixes[media!] : ""),
        media,
        schema: representation?.schema,
        operation,
      });
    }
    for (const [status, response] of Object.entries(original.responses)) {
      if (!/^\d{3}$/.test(status))
        throw new Error(
          `Extend response witnesses for ${operation.id}: ${status}`,
        );
      const media = Object.entries(resolve(response).content ?? {});
      const expected: Record<string, Exclude<Codec, "empty">> = {};
      for (const [type, definition] of media)
        expected[type.toLowerCase()] = codec(type, definition.schema);
      operation.metadata.responses[status] = { content: expected };
      for (const type of media.length
        ? media.map(([type]) => type)
        : [undefined]) {
        operation.responses.push({
          operation,
          status: Number(status),
          media: concreteMedia(type),
          declaredMedia: type,
          codec: type ? expected[type.toLowerCase()]! : "empty",
          label: `${operation.id} ${status} ${type ?? "empty"}`,
        });
      }
    }
    operations.push(operation);
  }
}
export const variants = operations.flatMap((operation) => operation.variants);
export const responses = operations.flatMap((operation) => operation.responses);

/** Serialization witnesses, deliberately not a claim of valid business DTOs. */
export function witness(
  original: Schema = {},
  media?: string,
  depth = 0,
): unknown {
  if (depth > 18)
    throw new Error("Recursive request witness requires an explicit strategy.");
  const schema = resolve(original);
  if (schema["x-json-schema"])
    return JSON.stringify(
      witness(schema["x-json-schema"], undefined, depth + 1),
    );
  if (schema.const !== undefined) return schema.const;
  if (schema.enum) return schema.enum.find((value) => value !== null) ?? null;
  if (schema.allOf) {
    const values = schema.allOf.map((part) => witness(part, media, depth + 1));
    if (
      values.some(
        (value) =>
          value === null || typeof value !== "object" || Array.isArray(value),
      )
    )
      throw new Error("Unsupported non-object allOf request.");
    return Object.assign({}, ...values);
  }
  if (schema.oneOf || schema.anyOf) {
    const choice = (schema.oneOf ?? schema.anyOf)!
      .map(resolve)
      .find((part) => part.type !== "null");
    if (!choice) return null;
    return witness(choice, media, depth + 1);
  }
  const type = Array.isArray(schema.type)
    ? schema.type.find((type) => type !== "null")
    : schema.type;
  if (schema.format === "binary") {
    const bytes = [
      new TextEncoder().encode("Café 🦇\u0000\n"),
      new Uint8Array([0xff, 0x80, 0]),
    ];
    return media === "multipart/form-data"
      ? new File(bytes, "survey café.txt", { type: "application/octet-stream" })
      : new Blob(bytes, {
          type: concreteMedia(media) ?? "application/octet-stream",
        });
  }
  switch (type) {
    case "string":
      return "Café 🦇 /?&=+%";
    case "integer":
      return 2;
    case "number":
      return -12.5;
    case "boolean":
      return false;
    case "null":
      return null;
    case "array":
      return Array.from(
        {
          length: Math.min(
            Math.max(2, schema.minItems ?? 0),
            schema.maxItems ?? Infinity,
          ),
        },
        () => witness(schema.items, media, depth + 1),
      );
    case "object":
    case undefined: {
      if (!schema.properties) return { witness: "Café 🦇", count: 0 };
      return Object.fromEntries(
        Object.entries(schema.properties)
          .filter(([, property]) => !resolve(property).readOnly)
          .map(([name, property]) => [
            name,
            witness(property, media, depth + 1),
          ]),
      );
    }
    default:
      throw new Error(`Extend request witness for schema type ${type}`);
  }
}

/** Read only the canonical transport policy; never use generated form metadata. */
export function permitsEmptyNull(original: Schema, field: string): boolean {
  const schema = resolve(original);
  if (schema.properties?.[field]?.["x-drf-null-as-empty"] === true) return true;
  return [
    ...(schema.anyOf ?? []),
    ...(schema.oneOf ?? []),
    ...(schema.allOf ?? []),
  ].some((part) => permitsEmptyNull(part, field));
}

export function argumentsFor(variant: Variant, omitOptionalQuery = false) {
  const operation = variant.operation;
  const paths = operation.pathParameters.map(
    (parameter) => `${parameter.name}/Café %?#+`,
  );
  const body = variant.media
    ? witness(variant.schema, variant.media)
    : undefined;
  const query = Object.fromEntries(
    operation.queryParameters.map((parameter) => [
      parameter.name,
      omitOptionalQuery && !parameter.required
        ? undefined
        : witness(parameter.schema),
    ]),
  );
  const headers = Object.fromEntries(
    operation.headerParameters.map((parameter) => [
      parameter.name,
      `wire-${parameter.name}`,
    ]),
  );
  const args: unknown[] = [...paths];
  if (variant.media) args.push(body);
  if (operation.queryParameters.length) args.push(query);
  return { args, paths, body, query, headers };
}
