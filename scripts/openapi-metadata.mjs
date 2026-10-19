import { sdkDocument } from "./openapi-scope.mjs";

/** Pure generation-time metadata projection; never maintains its own route list. */
export function operationOverrides(document) {
  const resolve = (value) => {
    if (!value?.$ref) return value;
    if (!value.$ref.startsWith("#/"))
      throw new Error("OpenAPI must be bundled before SDK generation.");
    const resolved = value.$ref
      .slice(2)
      .split("/")
      .reduce(
        (current, key) =>
          current?.[key.replace(/~1/g, "/").replace(/~0/g, "~")],
        document,
      );
    if (!resolved)
      throw new Error(`Unresolved OpenAPI reference: ${value.$ref}`);
    return resolve(resolved);
  };
  const overrides = {};
  for (const pathItem of Object.values(sdkDocument(document).paths)) {
    for (const [method, operation] of Object.entries(resolve(pathItem))) {
      if (
        ![
          "get",
          "post",
          "put",
          "patch",
          "delete",
          "head",
          "options",
          "trace",
        ].includes(method)
      )
        continue;
      if (!operation.operationId)
        throw new Error("Every operation requires a stable operationId.");
      if (overrides[operation.operationId])
        throw new Error(`Duplicate operationId: ${operation.operationId}`);
      const responses = {};
      for (const [status, original] of Object.entries(
        operation.responses ?? {},
      )) {
        const response = resolve(original);
        const content = {};
        for (const [mediaType, media] of Object.entries(
          response.content ?? {},
        )) {
          const schema = resolve(media.schema);
          content[mediaType.toLowerCase()] =
            schema?.format === "binary"
              ? "blob"
              : /(^application\/.*json$|\+json$)/i.test(mediaType)
                ? "json"
                : mediaType.startsWith("text/") || schema?.type === "string"
                  ? "text"
                  : "blob";
        }
        responses[
          status.toUpperCase() === "DEFAULT" ? "default" : status.toUpperCase()
        ] = { content };
      }
      const requestContent = resolve(operation.requestBody)?.content ?? {};
      const customMultipart = !!requestContent["multipart/form-data"];
      const customUrlEncoded =
        !!requestContent["application/x-www-form-urlencoded"];
      overrides[operation.operationId] = {
        requestOptions: {
          operation: { operationId: operation.operationId, responses },
        },
        ...(customMultipart
          ? {
              formData: {
                path: "./src/form-data.generated.ts",
                name: `${operation.operationId}Multipart`,
              },
            }
          : {}),
        ...(customUrlEncoded
          ? {
              formUrlEncoded: {
                path: "./src/form-data.generated.ts",
                name: `${operation.operationId}UrlEncoded`,
              },
            }
          : {}),
      };
    }
  }
  return overrides;
}

/** Orval passes only the body to form mutators. Generate policy-bearing wrappers
 * from the media-specific schema so null clears never become omitted updates. */
export function formMutators(document) {
  const resolve = (value) => {
    if (!value?.$ref) return value;
    if (!value.$ref.startsWith("#/"))
      throw new Error("OpenAPI must be bundled.");
    const target = value.$ref
      .slice(2)
      .split("/")
      .reduce(
        (current, key) =>
          current?.[key.replace(/~1/g, "/").replace(/~0/g, "~")],
        document,
      );
    if (!target) throw new Error(`Unresolved OpenAPI reference: ${value.$ref}`);
    const siblings = { ...value };
    delete siblings.$ref;
    return { ...resolve(target), ...siblings };
  };
  const properties = (value, seen = new Set()) => {
    const schema = resolve(value);
    if (!schema || seen.has(value)) return {};
    const visited = new Set(seen).add(value);
    const result = {};
    for (const part of [
      ...(schema.allOf ?? []),
      ...(schema.oneOf ?? []),
      ...(schema.anyOf ?? []),
    ]) {
      for (const [name, field] of Object.entries(properties(part, visited))) {
        // A valid union member can permit null while another requires a file.
        // The DTO selects the valid member; every permitted null uses the same
        // empty form value. Retain that transport policy across all members.
        result[name] = {
          ...field,
          ...(result[name]?.["x-drf-null-as-empty"] === true
            ? { "x-drf-null-as-empty": true }
            : {}),
        };
      }
    }
    for (const [name, field] of Object.entries(schema.properties ?? {}))
      result[name] = resolve(field);
    return result;
  };
  const lines = [
    "/** Generated from OpenAPI.yaml by scripts/generate.mjs. Do not edit. */",
    'import { unionFormData, unionUrlEncoded } from "./runtime/form-data";',
  ];
  for (const pathItem of Object.values(sdkDocument(document).paths)) {
    for (const [method, operation] of Object.entries(resolve(pathItem))) {
      if (
        ![
          "get",
          "post",
          "put",
          "patch",
          "delete",
          "head",
          "options",
          "trace",
        ].includes(method)
      )
        continue;
      if (!/^[A-Za-z_$][\w$]*$/.test(operation.operationId))
        throw new Error(
          `Operation ID cannot name a form mutator: ${operation.operationId}`,
        );
      const content = resolve(operation.requestBody)?.content ?? {};
      for (const [media, suffix, serializer, returnType] of [
        ["multipart/form-data", "Multipart", "unionFormData", "FormData"],
        [
          "application/x-www-form-urlencoded",
          "UrlEncoded",
          "unionUrlEncoded",
          "URLSearchParams",
        ],
      ]) {
        if (!content[media]) continue;
        const nullAsEmpty = Object.entries(properties(content[media].schema))
          .filter(([, field]) => field?.["x-drf-null-as-empty"] === true)
          .map(([name]) => name)
          .sort();
        lines.push(
          `export function ${operation.operationId}${suffix}(body?: object): ${returnType} {`,
          `  return ${serializer}(body, ${JSON.stringify(nullAsEmpty)});`,
          "}",
        );
      }
    }
  }
  return lines.join("\n") + "\n";
}
