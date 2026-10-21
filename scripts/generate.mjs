/* global Bun */
import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { loadOpenApiSchema } from "./openapi-source.mjs";
import { sdkDocument } from "./openapi-scope.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const check = process.argv.includes("--check");
// Validate the package snapshot before creating outputs or loading the generator.
const bytes = await loadOpenApiSchema(root);
const temporary = await mkdtemp(
  path.join(tmpdir(), "speleodb-api-generation-"),
);
try {
  for (const entry of [
    "orval.config.mjs",
    "tsconfig.json",
    "scripts",
    "src/runtime",
  ]) {
    await cp(path.join(root, entry), path.join(temporary, entry), {
      recursive: true,
    });
  }
  const schema = sdkDocument(Bun.YAML.parse(bytes.toString("utf8")));
  // JSON is valid YAML. This disposable SDK projection leaves the package's
  // reviewed snapshot and digest untouched, including excluded legacy routes.
  await writeFile(path.join(temporary, "OpenAPI.yaml"), JSON.stringify(schema));
  const { format } = await import("prettier");
  const { formMutators } = await import("./openapi-metadata.mjs");
  const require = createRequire(import.meta.url);
  const cli = require.resolve("orval/bin/orval");
  const formPath = path.join(temporary, "src/form-data.generated.ts");
  await writeFile(
    formPath,
    await format(formMutators(schema), { parser: "typescript" }),
  );
  const generated = spawnSync(
    process.execPath,
    [cli, "--config", path.join(temporary, "orval.config.mjs")],
    { cwd: temporary, stdio: "inherit" },
  );
  if (generated.error) throw generated.error;
  if (generated.status !== 0) process.exitCode = generated.status ?? 1;
  else if (check) {
    async function files(directory) {
      const entries = await readdir(directory, {
        recursive: true,
        withFileTypes: true,
      });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) =>
          path.relative(directory, path.join(entry.parentPath, entry.name)),
        )
        .sort();
    }
    if (
      !(await readFile(path.join(root, "src/form-data.generated.ts"))).equals(
        await readFile(formPath),
      )
    )
      throw new Error("Generated form policy drift. Run bun run generate.");
    const actualRoot = path.join(root, "src/generated");
    const expectedRoot = path.join(temporary, "src/generated");
    const actual = await files(actualRoot),
      expected = await files(expectedRoot);
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error("Generated SDK filenames differ. Run bun run generate.");
    for (const file of expected) {
      if (
        !(await readFile(path.join(actualRoot, file))).equals(
          await readFile(path.join(expectedRoot, file)),
        )
      ) {
        throw new Error(`Generated SDK drift: ${file}. Run bun run generate.`);
      }
    }
  } else {
    await rm(path.join(root, "src/generated"), {
      recursive: true,
      force: true,
    });
    await cp(
      path.join(temporary, "src/generated"),
      path.join(root, "src/generated"),
      {
        recursive: true,
      },
    );
    await cp(formPath, path.join(root, "src/form-data.generated.ts"));
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
