import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  cp,
  readdir,
  symlink,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadOpenApiSchema } from "../scripts/openapi-source.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const directories: string[] = [];
const original = Buffer.from("producer bytes\r\nCafé 🦇\n");

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture(
  bytes: Buffer = original,
  revision: string | null = null,
) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "speleodb-schema-source-test-"),
  );
  directories.push(directory);
  await mkdir(path.join(directory, "scripts"));
  await mkdir(path.join(directory, "src/generated"), { recursive: true });
  for (const name of ["generate.mjs", "openapi-source.mjs"]) {
    await copyFile(
      path.join(root, "scripts", name),
      path.join(directory, "scripts", name),
    );
  }
  await writeFile(
    path.join(directory, "openapi-source.json"),
    JSON.stringify({
      revision,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }),
  );
  await writeFile(path.join(directory, "producer-export"), bytes);
  await writeFile(
    path.join(directory, "src/generated/preserved.ts"),
    "existing generated operation\n",
  );
  await writeFile(
    path.join(directory, "src/form-data.generated.ts"),
    "existing form policy\n",
  );
  await writeFile(
    path.join(directory, "read-source.mjs"),
    'import { loadOpenApiSchema } from "./scripts/openapi-source.mjs";\n' +
      "process.stdout.write(await loadOpenApiSchema(process.cwd()));\n",
  );
  return directory;
}

function run(directory: string, args: string[], localPath?: string) {
  const env = { ...process.env };
  delete env.SPELEODB_OPENAPI_PATH;
  if (localPath !== undefined) env.SPELEODB_OPENAPI_PATH = localPath;
  return spawnSync(process.execPath, args, {
    cwd: directory,
    env,
    encoding: "utf8",
    timeout: 5_000,
  });
}

async function expectOutputsUnchanged(directory: string) {
  expect(
    await readFile(path.join(directory, "src/generated/preserved.ts"), "utf8"),
  ).toBe("existing generated operation\n");
  expect(
    await readFile(path.join(directory, "src/form-data.generated.ts"), "utf8"),
  ).toBe("existing form policy\n");
}

describe("single backend schema provenance", () => {
  it("reads an explicitly supplied export byte-for-byte during unpublished local maintenance", async () => {
    const directory = await fixture();
    const result = run(
      directory,
      ["read-source.mjs"],
      path.join(directory, "producer-export"),
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(Buffer.from(result.stdout)).toEqual(original);
  });

  it.each(["generate", "check"] as const)(
    "rejects changed bytes before writing any generated output in %s mode",
    async (mode) => {
      const directory = await fixture();
      const input = path.join(directory, "producer-export");
      await writeFile(input, Buffer.concat([original, Buffer.from(" ")]));
      const args = mode === "check" ? ["--check"] : [];
      const result = run(directory, ["scripts/generate.mjs", ...args], input);
      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Backend OpenAPI SHA-256 mismatch");
      await expectOutputsUnchanged(directory);
    },
  );

  it("rejects an empty input even when its digest matches", async () => {
    const directory = await fixture(Buffer.alloc(0));
    const result = run(
      directory,
      ["scripts/generate.mjs"],
      path.join(directory, "producer-export"),
    );
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("backend OpenAPI schema is empty");
    await expectOutputsUnchanged(directory);
  });

  it("rejects a relative maintenance path", async () => {
    const directory = await fixture();
    const result = run(directory, ["scripts/generate.mjs"], "producer-export");
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("explicit absolute path");
    await expectOutputsUnchanged(directory);
  });

  it("rejects an unpublished remote revision instead of discovering another local schema", async () => {
    const directory = await fixture();
    await writeFile(path.join(directory, "OpenAPI.yaml"), original);
    const result = run(directory, ["scripts/generate.mjs", "--check"]);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("backend schema revision is unpublished");
    await expectOutputsUnchanged(directory);
  });

  it("rejects a mutable backend reference even with a valid local export", async () => {
    const directory = await fixture(original, "master");
    const result = run(
      directory,
      ["scripts/generate.mjs"],
      path.join(directory, "producer-export"),
    );
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("full backend commit revision");
    await expectOutputsUnchanged(directory);
  });
});

async function generationFixture() {
  const bytes = await loadOpenApiSchema(root);
  const directory = await fixture(bytes);
  for (const entry of [
    "scripts",
    "src/runtime",
    "src/generated",
    "src/form-data.generated.ts",
    "orval.config.mjs",
    "tsconfig.json",
  ]) {
    await cp(path.join(root, entry), path.join(directory, entry), {
      recursive: true,
    });
  }
  // Dependencies belong to this standalone package; only the disposable fixture links them.
  await symlink(
    path.join(root, "node_modules"),
    path.join(directory, "node_modules"),
    "dir",
  );
  const temporary = path.join(directory, "generation-temporary");
  await mkdir(temporary);
  return { directory, temporary };
}

function generateFixture(directory: string, temporary: string) {
  return spawnSync(process.execPath, ["scripts/generate.mjs", "--check"], {
    cwd: directory,
    env: {
      ...process.env,
      TMPDIR: temporary,
      SPELEODB_OPENAPI_PATH: path.join(directory, "producer-export"),
    },
    encoding: "utf8",
    timeout: 110_000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

describe("generation isolation", () => {
  it("detects stale generated filenames without rewriting sources and removes temporary schema data", async () => {
    const { directory, temporary } = await generationFixture();
    const existing = await readFile(
      path.join(directory, "src/generated/operations.ts"),
    );
    const form = await readFile(
      path.join(directory, "src/form-data.generated.ts"),
    );
    const result = generateFixture(directory, temporary);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Generated SDK filenames differ");
    expect(
      await readFile(
        path.join(directory, "src/generated/preserved.ts"),
        "utf8",
      ),
    ).toBe("existing generated operation\n");
    expect(
      await readFile(path.join(directory, "src/generated/operations.ts")),
    ).toEqual(existing);
    expect(
      await readFile(path.join(directory, "src/form-data.generated.ts")),
    ).toEqual(form);
    // Orval's Jiti loader may retain its own code cache; schema workspaces must disappear.
    const leftovers = await readdir(temporary, { recursive: true });
    expect(
      leftovers.filter((name) => name.startsWith("speleodb-api-generation-")),
    ).toEqual([]);
    expect(leftovers.filter((name) => name.endsWith("OpenAPI.yaml"))).toEqual(
      [],
    );
  }, 120_000);

  it("preserves all existing output and cleans temporary inputs when Orval fails", async () => {
    const { directory, temporary } = await generationFixture();
    const existing = await readFile(
      path.join(directory, "src/generated/operations.ts"),
    );
    const form = await readFile(
      path.join(directory, "src/form-data.generated.ts"),
    );
    await writeFile(
      path.join(directory, "orval.config.mjs"),
      'throw new Error("intentional isolated generator failure");\n',
    );
    const result = generateFixture(directory, temporary);
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(
      "intentional isolated generator failure",
    );
    expect(
      await readFile(path.join(directory, "src/generated/operations.ts")),
    ).toEqual(existing);
    expect(
      await readFile(path.join(directory, "src/form-data.generated.ts")),
    ).toEqual(form);
    // Orval's Jiti loader may retain its own code cache; schema workspaces must disappear.
    const leftovers = await readdir(temporary, { recursive: true });
    expect(
      leftovers.filter((name) => name.startsWith("speleodb-api-generation-")),
    ).toEqual([]);
    expect(leftovers.filter((name) => name.endsWith("OpenAPI.yaml"))).toEqual(
      [],
    );
  }, 120_000);
});
