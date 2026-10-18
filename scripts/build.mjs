import { spawnSync } from "node:child_process";

for (const args of [
  [
    "build",
    "./src/index.ts",
    "--target=browser",
    "--format=esm",
    "--outdir=dist",
    "--sourcemap=external",
  ],
  ["./node_modules/typescript/bin/tsc", "--project", "tsconfig.build.json"],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
